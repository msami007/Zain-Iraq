import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { ArticleStatus, Language, Visibility } from "@prisma/client";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Fetch detailed article information
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    let tenantId = session?.user?.tenant_id;

    if (!tenantId) {
      const headerTenant = req.headers.get("x-tenant-id");
      if (headerTenant) {
        tenantId = headerTenant;
      } else {
        const zain = await prisma.tenant.findFirst({ where: { slug: "zain" } });
        if (!zain) {
          return NextResponse.json({ error: "Tenant setup required" }, { status: 500 });
        }
        tenantId = zain.id;
      }
    }

    const db = getTenantDb(tenantId);
    
    const article = await db.article.findFirst({
      where: { id },
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        variants: true,
        versions: {
          orderBy: { created_at: "desc" },
          include: { editor: { select: { id: true, name: true } } },
        },
        status_history: {
          orderBy: { created_at: "desc" },
          include: { actor: { select: { id: true, name: true } } },
        },
        workflow_route: {
          include: {
            steps: { orderBy: { step_number: "asc" } }
          }
        },
        current_step: {
          include: {
            team: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } }
          }
        },
        article_teams: {
          select: {
            team: {
              select: { id: true, name: true }
            }
          }
        },
        article_tags: {
          select: {
            tag: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Role restriction check for guests
    if (!session && article.status !== ArticleStatus.Published) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Visibility access control
    const viewer = session?.user;
    if (article.visibility === Visibility.ADMINS) {
      if (!viewer || (viewer.role !== "Admin" && viewer.role !== "SuperAdmin")) {
        return NextResponse.json({ error: "Forbidden: Admin-only article" }, { status: 403 });
      }
    } else if (article.visibility === Visibility.AGENTS || article.visibility === Visibility.PRIVATE) {
      if (!viewer) {
        return NextResponse.json({ error: "Unauthorized: Agent-only article" }, { status: 401 });
      }
      // For PRIVATE, also enforce team membership
      if (article.visibility === Visibility.PRIVATE && viewer.role !== "SuperAdmin") {
        const userTeams = await prisma.userTeam.findMany({ where: { user_id: viewer.id } });
        const userTeamIds = userTeams.map(ut => ut.team_id);
        const articleTeamIds = article.article_teams.map(at => at.team.id);
        if (!articleTeamIds.some(tid => userTeamIds.includes(tid))) {
          return NextResponse.json({ error: "Forbidden: You do not belong to the teams assigned to this article" }, { status: 403 });
        }
      }
    }

    // Log article view for customer/guest requests (not for agent/admin portal traffic)
    if (!session?.user) {
      await db.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_id: null,
          action: "Article Viewed",
          target_type: "Article",
          target_id: article.id,
          target_label: `"${article.title.slice(0, 80)}" (Guest)`,
          after: { article_id: article.id, title: article.title, channel: "customer_kb" } as any,
        },
      }).catch(() => {});
    }

    return NextResponse.json(article);
  } catch (error: any) {
    console.error("GET Article Detail Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Update article metadata, content variants, and workflow transitions
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: tenantId, id: userId } = session.user;

    // Agents may only submit their own Draft articles for review — nothing else
    const isAgentStatusOnly = role === "Agent";
    if (role !== "Admin" && role !== "SuperAdmin" && !isAgentStatusOnly) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const db = getTenantDb(tenantId);

    // Fetch the current article state
    const currentArticle = await db.article.findFirst({
      where: { id },
      include: { variants: true },
    });

    if (!currentArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      slug,
      category_id,
      language,
      visibility: visibilityInput,
      owner_id,
      review_due,
      status: targetStatus, // New workflow status
      comment,
      variants, // Array of variant updates: [{ channel: "agent", detailed_steps: "..." }]
      team_ids,
      workflow_route_id,
      tags,
    } = body;

    // Agents: only allow Draft → InReview on their own articles
    if (isAgentStatusOnly) {
      if (currentArticle.author_id !== userId) {
        return NextResponse.json({ error: "Forbidden: Agents can only submit their own articles." }, { status: 403 });
      }
      if (targetStatus !== "InReview" || currentArticle.status !== "Draft") {
        return NextResponse.json({ error: "Forbidden: Agents may only submit a Draft article for review." }, { status: 403 });
      }
    }

    // Enforce mandatory team assignment for all roles if team_ids is updated
    if (team_ids !== undefined) {
      if (!Array.isArray(team_ids) || team_ids.length === 0) {
        return NextResponse.json(
          { error: "Articles must be explicitly assigned to at least one team." },
          { status: 400 }
        );
      }
    }

    // Enforce Admin restrictions on teams
    if (role === "Admin") {
      const userTeams = await prisma.userTeam.findMany({
        where: { user_id: userId }
      });
      const userTeamIds = userTeams.map(ut => ut.team_id);

      if (team_ids !== undefined && Array.isArray(team_ids)) {
        const invalidTeams = team_ids.filter(tid => !userTeamIds.includes(tid));
        if (invalidTeams.length > 0) {
          return NextResponse.json(
            { error: "Forbidden: Admins can only assign articles to teams they belong to." },
            { status: 403 }
          );
        }
      }
    }

    const beforeState = { ...currentArticle };

    // Validate workflow transitions and separation of duties if status is changing
    let finalStatus = currentArticle.status;
    let publishedAt = currentArticle.published_at;

    let nextStepId: string | null | undefined = undefined;

    if (targetStatus && targetStatus !== currentArticle.status) {
      const from = currentArticle.status;
      const to = targetStatus as ArticleStatus;

      // 1. Enforce No Status Skipping:
      // Workflow: Draft -> InReview -> Approved -> Published -> Archived
      let isValidTransition = false;
      if (from === ArticleStatus.Draft && (to === ArticleStatus.InReview || to === ArticleStatus.Archived)) {
        isValidTransition = true;
      } else if (from === ArticleStatus.InReview) {
        isValidTransition = to === ArticleStatus.Approved || to === ArticleStatus.Rejected;
      } else if (from === ArticleStatus.Approved) {
        isValidTransition = to === ArticleStatus.Published || to === ArticleStatus.Rejected;
      } else if (from === ArticleStatus.Published) {
        isValidTransition = to === ArticleStatus.Archived || to === ArticleStatus.Rejected;
      } else if (from === ArticleStatus.Archived) {
        isValidTransition = to === ArticleStatus.Draft;
      } else if (from === ArticleStatus.Rejected) {
        // Author can revise (back to Draft) or resubmit directly (back to InReview)
        isValidTransition = to === ArticleStatus.Draft || to === ArticleStatus.InReview;
      }

      if (!isValidTransition) {
        return NextResponse.json(
          {
            error: `Invalid workflow transition: Cannot skip status from ${from} to ${to}. Must follow Draft -> InReview -> Approved -> Published.`,
          },
          { status: 400 }
        );
      }

      // 2. Enforce Separation of Duties:
      // Author/Editor cannot Approve or Publish their own article
      if (to === ArticleStatus.Approved || to === ArticleStatus.Published) {
        if (currentArticle.author_id === userId) {
          return NextResponse.json(
            {
              error: "Forbidden: Separation of duties enforced. The author of an article cannot approve or publish it.",
            },
            { status: 403 }
          );
        }
      }

      // Check if custom workflow is assigned
      const activeWorkflowRouteId = workflow_route_id !== undefined ? workflow_route_id : currentArticle.workflow_route_id;

      if (activeWorkflowRouteId) {
        // Handle transitions under custom workflow
        if (from === ArticleStatus.Draft && to === ArticleStatus.InReview) {
          // Submit for review: set to first step of custom workflow
          const firstStep = await db.workflowStep.findFirst({
            where: { route_id: activeWorkflowRouteId },
            orderBy: { step_number: "asc" }
          });
          if (!firstStep) {
            return NextResponse.json(
              { error: "Selected workflow route has no defined steps." },
              { status: 400 }
            );
          }
          finalStatus = ArticleStatus.InReview;
          nextStepId = firstStep.id;
        } else if (from === ArticleStatus.InReview && to === ArticleStatus.Approved) {
          // Approving step
          if (currentArticle.current_step_id) {
            const currentStep = await db.workflowStep.findUnique({
              where: { id: currentArticle.current_step_id }
            });
            if (!currentStep) {
              return NextResponse.json({ error: "Active workflow step not found." }, { status: 400 });
            }

            // Verify role restriction
            const roleHierarchy = { Agent: 1, Admin: 2, SuperAdmin: 3 };
            const userLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 1;
            const requiredLevel = roleHierarchy[currentStep.role_restriction as keyof typeof roleHierarchy] || 1;
            if (role !== "SuperAdmin" && userLevel < requiredLevel) {
              return NextResponse.json(
                { error: `Forbidden: You need ${currentStep.role_restriction} role to approve this step.` },
                { status: 403 }
              );
            }

            // Verify team restriction
            if (currentStep.team_id) {
              const userInTeam = await prisma.userTeam.findFirst({
                where: { user_id: userId, team_id: currentStep.team_id }
              });
              if (!userInTeam && role !== "SuperAdmin") {
                return NextResponse.json(
                  { error: "Forbidden: You do not belong to the required team for this approval step." },
                  { status: 403 }
                );
              }
            }

            // Verify specific user restriction
            if (currentStep.user_id && currentStep.user_id !== userId && role !== "SuperAdmin") {
              return NextResponse.json(
                { error: "Forbidden: Only the designated user can approve this step." },
                { status: 403 }
              );
            }

            // Find next step
            const nextStep = await db.workflowStep.findFirst({
              where: { route_id: activeWorkflowRouteId, step_number: currentStep.step_number + 1 },
              orderBy: { step_number: "asc" }
            });

            if (nextStep) {
              // Stay InReview, update current_step_id to next step
              finalStatus = ArticleStatus.InReview;
              nextStepId = nextStep.id;
            } else {
              // Final step approved, set status to Approved
              finalStatus = ArticleStatus.Approved;
              nextStepId = null;
            }
          } else {
            finalStatus = ArticleStatus.Approved;
            nextStepId = null;
          }
        } else if (to === ArticleStatus.Rejected) {
          // Rejected — keeps separate status so author can see it
          finalStatus = ArticleStatus.Rejected;
          nextStepId = null;
        } else {
          finalStatus = to;
          if (to === ArticleStatus.Published) {
            publishedAt = new Date();
          }
          nextStepId = null;
        }
      } else {
        // Standard Direct Workflow
        finalStatus = to;
        if (to === ArticleStatus.Published) {
          publishedAt = new Date();
        }
        nextStepId = null;
      }

      // Record status transition in history
      let historyComment = comment || `Status transitioned from ${from} to ${finalStatus}`;
      if (activeWorkflowRouteId && from === ArticleStatus.InReview && to === ArticleStatus.Approved && nextStepId) {
        const currentStep = await db.workflowStep.findUnique({ where: { id: currentArticle.current_step_id || "" } });
        const nextStep = await db.workflowStep.findUnique({ where: { id: nextStepId } });
        historyComment = comment || `Approved step "${currentStep?.name}". Advanced to step "${nextStep?.name}".`;
      } else if (activeWorkflowRouteId && from === ArticleStatus.InReview && to === ArticleStatus.Approved && !nextStepId) {
        const currentStep = await db.workflowStep.findUnique({ where: { id: currentArticle.current_step_id || "" } });
        historyComment = comment || `Approved final step "${currentStep?.name}". Workflow complete.`;
      }

      await db.articleStatusHistory.create({
        data: {
          article_id: id,
          from_status: from,
          to_status: finalStatus,
          actor_id: userId,
          comment: historyComment,
        },
      });
    }

    // Prepare update data
    const formattedSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") : undefined;

    // Update Article and team mappings inside a transaction
    const updatedArticle = await db.$transaction(async (tx) => {
      const art = await tx.article.update({
        where: { id },
        data: {
          title: title || undefined,
          slug: formattedSlug || undefined,
          category_id: category_id || undefined,
          language: language || undefined,
          visibility: visibilityInput ? (visibilityInput as Visibility) : undefined,
          owner_id: owner_id || undefined,
          review_due: review_due ? new Date(review_due) : undefined,
          status: finalStatus,
          published_at: publishedAt,
          workflow_route_id: workflow_route_id !== undefined ? (workflow_route_id || null) : undefined,
          current_step_id: nextStepId !== undefined ? nextStepId : undefined,
        },
      });

      if (team_ids !== undefined && Array.isArray(team_ids)) {
        await tx.articleTeam.deleteMany({
          where: { article_id: id }
        });

        if (team_ids.length > 0) {
          await tx.articleTeam.createMany({
            data: team_ids.map((tid: string) => ({
              article_id: id,
              team_id: tid,
              tenant_id: tenantId,
            })),
          });
        }
      }

      if (tags !== undefined && Array.isArray(tags)) {
        await tx.articleTag.deleteMany({
          where: { article_id: id }
        });

        const uniqueTags = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));
        const tagIds: string[] = [];
        
        for (const tagName of uniqueTags) {
          let tag = await tx.tag.findFirst({
            where: {
              tenant_id: tenantId,
              name: { equals: tagName, mode: "insensitive" }
            }
          });
          if (!tag) {
            tag = await tx.tag.create({
              data: {
                tenant_id: tenantId,
                name: tagName
              }
            });
          }
          tagIds.push(tag.id);
        }

        const uniqueTagIds = Array.from(new Set(tagIds));
        if (uniqueTagIds.length > 0) {
          await tx.articleTag.createMany({
            data: uniqueTagIds.map((tid) => ({
              article_id: id,
              tag_id: tid,
              tenant_id: tenantId,
            })),
          });
        }
      }

      return art;
    });

    // Handle inline variants updates (Agent/Chatbot/WhatsApp)
    let defaultBodyChanged = false;
    let newDefaultBodyContent = "";

    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        const { channel, short_answer, detailed_steps, copy_ready_macro, image_url, video_link, troubleshooting_flow } = v;

        if (channel === "default" && detailed_steps && detailed_steps !== currentArticle.variants.find(x => x.channel === "default")?.detailed_steps) {
          defaultBodyChanged = true;
          newDefaultBodyContent = detailed_steps;
        }

        // Upsert variant
        const existingVariant = currentArticle.variants.find((x) => x.channel === channel);
        if (existingVariant) {
          await db.articleVariant.update({
            where: { id: existingVariant.id },
            data: {
              short_answer: short_answer !== undefined ? short_answer : undefined,
              detailed_steps: detailed_steps !== undefined ? detailed_steps : undefined,
              copy_ready_macro: copy_ready_macro !== undefined ? copy_ready_macro : undefined,
              image_url: image_url !== undefined ? image_url : undefined,
              video_link: video_link !== undefined ? video_link : undefined,
              troubleshooting_flow: troubleshooting_flow !== undefined ? troubleshooting_flow : undefined,
            },
          });
        } else {
          await db.articleVariant.create({
            data: {
              article_id: id,
              channel: channel,
              short_answer: short_answer || "",
              detailed_steps: detailed_steps || "",
              copy_ready_macro: copy_ready_macro || "",
              image_url: image_url || "",
              video_link: video_link || "",
              troubleshooting_flow: troubleshooting_flow || undefined,
            },
          });
        }
      }
    }

    // If default variant content changed, log a new version
    if (defaultBodyChanged) {
      const latestVersion = await db.articleVersion.findFirst({
        where: { article_id: id },
        orderBy: { version_no: "desc" },
      });
      const nextVer = latestVersion ? latestVersion.version_no + 1 : 1;

      await db.articleVersion.create({
        data: {
          article_id: id,
          version_no: nextVer,
          body: newDefaultBodyContent,
          editor_id: userId,
        },
      });
    }

    // Write audit log entry
    await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: "Update Article",
        target_type: "Article",
        target_id: id,
        target_label: `Article Updated: ${updatedArticle.title} (${updatedArticle.status})`,
        before: beforeState as any,
        after: updatedArticle as any,
      },
    });

    const finalArticleWithRelations = await db.article.findUnique({
      where: { id },
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        variants: true,
        versions: {
          orderBy: { created_at: "desc" },
          include: { editor: { select: { id: true, name: true } } },
        },
        status_history: {
          orderBy: { created_at: "desc" },
          include: { actor: { select: { id: true, name: true } } },
        },
        workflow_route: {
          include: {
            steps: { orderBy: { step_number: "asc" } }
          }
        },
        current_step: {
          include: {
            team: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } }
          }
        },
        article_teams: {
          select: {
            team: {
              select: { id: true, name: true }
            }
          }
        },
        article_tags: {
          select: {
            tag: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    return NextResponse.json(finalArticleWithRelations);
  } catch (error: any) {
    console.error("PUT Article Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Delete an article
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: tenantId, id: userId } = session.user;

    // Enforce permission matrix: only Admin and SuperAdmin can delete
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const db = getTenantDb(tenantId);

    // Fetch the article details
    const article = await db.article.findFirst({
      where: { id },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Perform standard delete
    await db.article.delete({
      where: { id },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: "Delete Article",
        target_type: "Article",
        target_id: id,
        target_label: `Article Deleted: ${article.title}`,
        before: article as any,
      },
    });

    return NextResponse.json({ success: true, message: "Article deleted successfully" });
  } catch (error: any) {
    console.error("DELETE Article Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
