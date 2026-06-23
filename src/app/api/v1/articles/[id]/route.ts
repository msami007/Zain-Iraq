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
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Role restriction check for guests
    if (!session && article.status !== ArticleStatus.Published) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Enforce permission matrix: only Admin and SuperAdmin can modify content
    if (role !== "Admin" && role !== "SuperAdmin") {
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
      owner_id,
      review_due,
      visibility,
      status: targetStatus, // New workflow status
      comment,
      variants, // Array of variant updates: [{ channel: "agent", detailed_steps: "..." }]
    } = body;

    const beforeState = { ...currentArticle };

    // Validate workflow transitions and separation of duties if status is changing
    let finalStatus = currentArticle.status;
    let publishedAt = currentArticle.published_at;

    if (targetStatus && targetStatus !== currentArticle.status) {
      const from = currentArticle.status;
      const to = targetStatus as ArticleStatus;

      // 1. Enforce No Status Skipping:
      // Workflow: Draft -> InReview -> Approved -> Published -> Archived
      let isValidTransition = false;
      if (from === ArticleStatus.Draft && to === ArticleStatus.InReview) {
        isValidTransition = true;
      } else if (from === ArticleStatus.InReview) {
        // Can be approved or rejected back to Draft
        isValidTransition = to === ArticleStatus.Approved || to === ArticleStatus.Draft;
      } else if (from === ArticleStatus.Approved) {
        // Can be published or demoted back to Draft
        isValidTransition = to === ArticleStatus.Published || to === ArticleStatus.Draft;
      } else if (from === ArticleStatus.Published) {
        // Can be archived or demoted back to Draft
        isValidTransition = to === ArticleStatus.Archived || to === ArticleStatus.Draft;
      } else if (from === ArticleStatus.Archived) {
        // Can be sent back to Draft to restart the loop
        isValidTransition = to === ArticleStatus.Draft;
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

      finalStatus = to;
      if (to === ArticleStatus.Published) {
        publishedAt = new Date();
      }

      // Record status transition in history
      await db.articleStatusHistory.create({
        data: {
          article_id: id,
          from_status: from,
          to_status: to,
          actor_id: userId,
          comment: comment || `Status transitioned from ${from} to ${to}`,
        },
      });
    }

    // Prepare update data
    const formattedSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") : undefined;

    // Update the Article
    const updatedArticle = await db.article.update({
      where: { id },
      data: {
        title: title || undefined,
        slug: formattedSlug || undefined,
        category_id: category_id || undefined,
        language: language || undefined,
        owner_id: owner_id || undefined,
        review_due: review_due ? new Date(review_due) : undefined,
        visibility: visibility || undefined,
        status: finalStatus,
        published_at: publishedAt,
      },
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

    return NextResponse.json(updatedArticle);
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
