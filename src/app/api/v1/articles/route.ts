import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { ArticleStatus, Language, Visibility } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let tenantId = session?.user?.tenant_id;
    const userRole = session?.user?.role;

    // Resolve tenant for guest requests
    if (!tenantId) {
      const headerTenant = req.headers.get("x-tenant-id");
      if (headerTenant) {
        tenantId = headerTenant;
      } else {
        // Fallback to Zain
        const zain = await prisma.tenant.findFirst({ where: { slug: "zain" } });
        if (!zain) {
          return NextResponse.json({ error: "Tenant setup required" }, { status: 500 });
        }
        tenantId = zain.id;
      }
    }

    const db = getTenantDb(tenantId);
    const searchParams = req.nextUrl.searchParams;

    // Parse filters
    const language = searchParams.get("language") as Language | null;
    const categoryId = searchParams.get("category_id") || undefined;
    const authoredByMe = searchParams.get("authored_by_me") === "true";
    const authorId = authoredByMe && session?.user ? session.user.id : (searchParams.get("author_id") || undefined);
    const statusFilter = searchParams.get("status") as ArticleStatus | null;
    const search = searchParams.get("search") || "";

    // Determine status accessibility based on permission matrix:
    // - Guests see only Published
    // - Agents/Admins/SuperAdmins can see all statuses (agents see read-only)
    let statusClause: any = undefined;
    if (!session || !userRole) {
      statusClause = ArticleStatus.Published;
    } else if (statusFilter) {
      statusClause = statusFilter;
    }

    // Team access filter
    let teamFilter: any = {};
    if (!session || !userRole) {
      teamFilter = { visibility: Visibility.PUBLIC };
    } else if (userRole !== "SuperAdmin") {
      const userTeams = await prisma.userTeam.findMany({
        where: { user_id: session.user.id }
      });
      const teamIds = userTeams.map(ut => ut.team_id);
      teamFilter = {
        OR: [
          { visibility: Visibility.PUBLIC },
          {
            visibility: Visibility.PRIVATE,
            article_teams: {
              some: {
                team_id: { in: teamIds }
              }
            }
          }
        ]
      };
    }

    const articles = await db.article.findMany({
      where: {
        language: language || undefined,
        category_id: categoryId,
        author_id: authorId,
        status: statusClause,
        ...teamFilter,
        OR: search
          ? [
              { title: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        variants: true,
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
        },
        status_history: {
          orderBy: { created_at: "desc" },
          include: {
            actor: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { updated_at: "desc" },
    });

    return NextResponse.json(articles);
  } catch (error: any) {
    console.error("GET Articles Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: tenantId, id: userId } = session.user;

    // Enforce permission matrix: only Admin and SuperAdmin can create/edit articles
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      slug,
      category_id,
      language,
      bodyText,
      owner_id,
      review_due,
      team_ids,
      workflow_route_id,
      tags,
      origin_gap_id,
    } = body;

    if (!title || !category_id || !bodyText) {
      return NextResponse.json(
        { error: "Title, Category, and Body content are required" },
        { status: 400 }
      );
    }

    // Enforce mandatory team assignment for all roles
    if (!team_ids || !Array.isArray(team_ids) || team_ids.length === 0) {
      return NextResponse.json(
        { error: "Articles must be explicitly assigned to at least one team." },
        { status: 400 }
      );
    }

    // Enforce Admin restrictions: Admin can only create articles for teams they belong to
    if (role === "Admin") {
      const userTeams = await prisma.userTeam.findMany({
        where: { user_id: userId }
      });
      const userTeamIds = userTeams.map(ut => ut.team_id);

      const invalidTeams = team_ids.filter(tid => !userTeamIds.includes(tid));
      if (invalidTeams.length > 0) {
        return NextResponse.json(
          { error: "Forbidden: Admins can only assign articles to teams they belong to." },
          { status: 403 }
        );
      }
    }

    const formattedSlug = slug
      ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : title.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    const db = getTenantDb(tenantId);

    if (workflow_route_id) {
      const route = await db.workflowRoute.findFirst({ where: { id: workflow_route_id } });
      if (!route) {
        return NextResponse.json({ error: "Workflow route not found" }, { status: 400 });
      }
      if (!route.is_active) {
        return NextResponse.json({ error: "The selected workflow route is inactive" }, { status: 400 });
      }
    }

    // Verify slug uniqueness under this tenant
    const existing = await db.article.findFirst({
      where: { slug: formattedSlug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An article with this slug already exists in the organization" },
        { status: 409 }
      );
    }

    // Create article and team relations inside a transaction
    const article = await db.$transaction(async (tx) => {
      const art = await tx.article.create({
        data: {
          tenant_id: tenantId,
          title,
          slug: formattedSlug,
          category_id,
          language: language || Language.en,
          status: ArticleStatus.Draft,
          visibility: Visibility.PUBLIC, // Default to PUBLIC as Visibility selection is removed from UI
          author_id: userId,
          owner_id: owner_id || userId,
          review_due: review_due ? new Date(review_due) : null,
          workflow_route_id: workflow_route_id || null,
        },
      });

      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        await tx.articleTeam.createMany({
          data: team_ids.map((tid: string) => ({
            article_id: art.id,
            team_id: tid,
            tenant_id: tenantId,
          })),
        });
      }

      if (tags && Array.isArray(tags) && tags.length > 0) {
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
              article_id: art.id,
              tag_id: tid,
              tenant_id: tenantId,
            })),
          });
        }
      }

      if (origin_gap_id) {
        const existingGap = await tx.knowledgeGap.findUnique({
          where: { id: origin_gap_id },
        });
        if (existingGap && existingGap.tenant_id === tenantId) {
          await tx.knowledgeGap.update({
            where: { id: origin_gap_id },
            data: {
              status: "RESOLVED",
              resolving_article_id: art.id,
            },
          });

          await tx.auditLog.create({
            data: {
              tenant_id: tenantId,
              actor_id: userId,
              action: "Update Knowledge Gap",
              target_type: "KnowledgeGap",
              target_id: origin_gap_id,
              target_label: `Gap Resolved via Article Creation: RESOLVED (${existingGap.query_text.slice(0, 30)})`,
              after: { id: origin_gap_id, status: "RESOLVED", resolving_article_id: art.id } as any,
            },
          });
        }
      }

      return art;
    });

    // Create the default channel variant
    await db.articleVariant.create({
      data: {
        article_id: article.id,
        channel: "default",
        short_answer: bodyText.slice(0, 150),
        detailed_steps: bodyText,
      },
    });

    // Create initial article version
    await db.articleVersion.create({
      data: {
        article_id: article.id,
        version_no: 1,
        body: bodyText,
        editor_id: userId,
      },
    });

    // Write initial status history log (Draft)
    await db.articleStatusHistory.create({
      data: {
        article_id: article.id,
        from_status: ArticleStatus.Draft,
        to_status: ArticleStatus.Draft,
        actor_id: userId,
        comment: "Initial article draft created",
      },
    });

    // Log this creation event in the audit trail
    await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: "Create Article",
        target_type: "Article",
        target_id: article.id,
        target_label: `Article Created: ${article.title} (Draft)`,
        after: article as any,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error: any) {
    console.error("POST Article Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
