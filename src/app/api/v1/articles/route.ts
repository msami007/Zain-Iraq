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
    const authorId = searchParams.get("author_id") || undefined;
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

    const articles = await db.article.findMany({
      where: {
        language: language || undefined,
        category_id: categoryId,
        author_id: authorId,
        status: statusClause,
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
      visibility,
    } = body;

    if (!title || !category_id || !bodyText) {
      return NextResponse.json(
        { error: "Title, Category, and Body content are required" },
        { status: 400 }
      );
    }

    const formattedSlug = slug
      ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : title.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    const db = getTenantDb(tenantId);

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

    // Create the article in Draft status
    const article = await db.article.create({
      data: {
        tenant_id: tenantId,
        title,
        slug: formattedSlug,
        category_id,
        language: language || Language.en,
        status: ArticleStatus.Draft,
        visibility: visibility || Visibility.PUBLIC,
        author_id: userId,
        owner_id: owner_id || userId,
        review_due: review_due ? new Date(review_due) : null,
      },
    });

    // Create the default channel variant
    const variant = await db.articleVariant.create({
      data: {
        article_id: article.id,
        channel: "default",
        short_answer: bodyText.slice(0, 150), // simple short answer summary
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
