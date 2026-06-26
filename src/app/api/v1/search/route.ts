import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { Language, Channel, GapStatus, Visibility } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let tenantId = session?.user?.tenant_id;

    // Parse request body
    const body = await req.json();
    const { query, language, channel, filters } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Resolve tenant for guest requests
    if (!tenantId) {
      const headerTenant = req.headers.get("x-tenant-id");
      if (headerTenant) {
        tenantId = headerTenant;
      } else {
        // Fallback to Zain tenant ID from slug
        const zain = await prisma.tenant.findFirst({ where: { slug: "zain" } });
        if (!zain) {
          return NextResponse.json({ error: "Tenant setup required" }, { status: 500 });
        }
        tenantId = zain.id;
      }
    }

    const db = getTenantDb(tenantId);
    const mappedLanguage = language === "ar" ? Language.ar : Language.en;
    const mappedChannel = channel ? (channel as Channel) : Channel.default;

    // Search query in database
    // Authenticated users (Agent/Admin/SuperAdmin) can search all statuses, guests see Published only
    const searchStatus = session?.user?.role ? undefined : "Published";

    // Team access filter — enforces visibility tier + optional team restriction
    let teamFilter: any = {};
    if (!session || !session.user) {
      teamFilter = { visibility: Visibility.PUBLIC };
    } else if (session.user.role === "Agent") {
      const userTeams = await prisma.userTeam.findMany({ where: { user_id: session.user.id } });
      const teamIds = userTeams.map(ut => ut.team_id);
      teamFilter = {
        OR: [
          { visibility: Visibility.PUBLIC },
          {
            visibility: { in: [Visibility.AGENTS, Visibility.PRIVATE] },
            OR: [
              { article_teams: { none: {} } },
              { article_teams: { some: { team_id: { in: teamIds } } } },
            ],
          },
        ],
      };
    } else if (session.user.role === "Admin") {
      const userTeams = await prisma.userTeam.findMany({ where: { user_id: session.user.id } });
      const teamIds = userTeams.map(ut => ut.team_id);
      teamFilter = {
        OR: [
          { visibility: Visibility.PUBLIC },
          {
            visibility: { in: [Visibility.AGENTS, Visibility.ADMINS] },
            OR: [
              { article_teams: { none: {} } },
              { article_teams: { some: { team_id: { in: teamIds } } } },
            ],
          },
          {
            visibility: Visibility.PRIVATE,
            article_teams: { some: { team_id: { in: teamIds } } },
          },
        ],
      };
    }
    // SuperAdmin: teamFilter stays {} (sees everything)

    const cleanQuery = query.trim();
    const words = cleanQuery.split(/\s+/).filter((w) => w.length > 1);

    const searchConditions: any[] = [
      { title: { contains: cleanQuery, mode: "insensitive" } },
      { slug: { contains: cleanQuery, mode: "insensitive" } },
      { category: { name: { contains: cleanQuery, mode: "insensitive" } } },
      // Search inside article variant bodies so Arabic and multi-language content is findable
      { variants: { some: { detailed_steps: { contains: cleanQuery, mode: "insensitive" } } } },
      { variants: { some: { short_answer: { contains: cleanQuery, mode: "insensitive" } } } },
    ];

    // Make query flexible by matching individual words too
    for (const word of words) {
      searchConditions.push(
        { title: { contains: word, mode: "insensitive" } },
        { slug: { contains: word, mode: "insensitive" } },
        { category: { name: { contains: word, mode: "insensitive" } } },
        { variants: { some: { detailed_steps: { contains: word, mode: "insensitive" } } } },
        { variants: { some: { short_answer: { contains: word, mode: "insensitive" } } } }
      );
    }

    // Search across both languages so Arabic queries can find Arabic articles
    // and English queries can find all content
    const whereClause: any = {
      status: searchStatus ? (searchStatus as any) : undefined,
      OR: searchConditions,
      ...teamFilter,
    };

    // Apply search filters
    if (filters) {
      if (filters.category_id) {
        whereClause.category_id = filters.category_id;
      }
      if (filters.author_id) {
        whereClause.author_id = filters.author_id;
      }
      if (filters.date_start || filters.date_end) {
        whereClause.created_at = {};
        if (filters.date_start) {
          whereClause.created_at.gte = new Date(filters.date_start);
        }
        if (filters.date_end) {
          whereClause.created_at.lte = new Date(filters.date_end);
        }
      }
    }

    const articles = await db.article.findMany({
      where: whereClause,
      include: {
        category: true,
        variants: { select: { detailed_steps: true, short_answer: true } },
      },
    });

    const results = articles.map((article) => {
      const titleLower = article.title.toLowerCase();
      const queryLower = cleanQuery.toLowerCase();
      const categoryLower = article.category?.name.toLowerCase() ?? "";

      // Collect all searchable text from variants
      const variantBodies = article.variants
        .map((v) => `${v.short_answer ?? ""} ${v.detailed_steps ?? ""}`)
        .join(" ")
        .toLowerCase();

      let score = 0.0;

      // 1. Exact title match: 1.0
      if (titleLower === queryLower) {
        score = 1.0;
      }
      // 2. Title starts with query: 0.85
      else if (titleLower.startsWith(queryLower)) {
        score = 0.85;
      }
      // 3. Title contains full phrase: 0.65
      else if (titleLower.includes(queryLower)) {
        score = 0.65;
      }
      // 4. Variant body contains full phrase: 0.5
      else if (variantBodies.includes(queryLower)) {
        score = 0.5;
      }
      // 5. Word-level matching across title, category, and body
      else if (words.length > 0) {
        const titleMatches = words.filter((w) => titleLower.includes(w.toLowerCase())).length;
        const categoryMatches = words.filter((w) => categoryLower.includes(w.toLowerCase())).length;
        const bodyMatches = words.filter((w) => variantBodies.includes(w.toLowerCase())).length;

        // Weight title matches highest, body matches contribute too
        const titleScore = (titleMatches / words.length) * 0.55;
        const categoryScore = (categoryMatches / words.length) * 0.15;
        const bodyScore = (bodyMatches / words.length) * 0.25;
        score = titleScore + categoryScore + bodyScore;
      }

      return {
        article_id: article.id,
        title: article.title,
        category: article.category.name,
        match_score: Number(Math.min(score, 1.0).toFixed(3)),
        status: article.status,
        language: article.language,
      };
    });

    // Filter out articles with no meaningful match (score === 0)
    const filteredResults = results.filter(r => r.match_score > 0);

    // Sort results by score desc
    filteredResults.sort((a, b) => b.match_score - a.match_score);

    // Log the search query in database
    await db.searchQuery.create({
      data: {
        tenant_id: tenantId,
        query_text: query,
        language: mappedLanguage,
        channel: mappedChannel,
        user_id: session?.user?.id || undefined,
        results_count: filteredResults.length,
        top_match_score: filteredResults.length > 0 ? filteredResults[0].match_score : 0.0,
      },
    });

    if (filteredResults.length > 0) {
      return NextResponse.json({
        results: filteredResults,
        gap_logged: false,
      });
    } else {
      // Zero-result recovery: Log gap
      // Check if a gap with this query_text already exists for this tenant
      const existingGap = await db.knowledgeGap.findFirst({
        where: {
          query_text: query,
          status: { not: GapStatus.RESOLVED },
        },
      });

      let gapId = "";
      let gapTargetId = "";

      const auditActorId = session?.user?.id || undefined;

      if (existingGap) {
        // Increment occurrences
        const updated = await db.knowledgeGap.update({
          where: { id: existingGap.id },
          data: { occurrences: existingGap.occurrences + 1 },
        });
        gapId = updated.id;
        gapTargetId = updated.id;

        await db.auditLog.create({
          data: {
            tenant_id: tenantId,
            actor_id: auditActorId,
            action: "Knowledge Gap Reported",
            target_type: "KnowledgeGap",
            target_id: gapTargetId,
            target_label: `Search miss: "${query.slice(0, 50)}" (${session?.user ? "Agent" : "Customer"}, repeated)`,
            after: { gap_id: gapTargetId, occurrences: updated.occurrences } as any,
          },
        }).catch(() => {});
      } else {
        // Create new gap
        const created = await db.knowledgeGap.create({
          data: {
            tenant_id: tenantId,
            query_text: query,
            language: mappedLanguage,
            channel: mappedChannel,
            status: GapStatus.NEW,
            source: "search",
            reported_by: session?.user?.id || undefined,
          },
        });
        gapId = created.id;
        gapTargetId = created.id;

        await db.auditLog.create({
          data: {
            tenant_id: tenantId,
            actor_id: auditActorId,
            action: "Knowledge Gap Reported",
            target_type: "KnowledgeGap",
            target_id: gapTargetId,
            target_label: `Search miss: "${query.slice(0, 50)}" (${session?.user ? "Agent" : "Customer"})`,
            after: created as any,
          },
        }).catch(() => {});
      }

      // Generate suggested categories based on words in query
      const words = query.split(/\s+/);
      const suggestedCategories = await db.category.findMany({
        where: {
          name: {
            in: words,
            mode: "insensitive",
          },
        },
        take: 3,
      });

      return NextResponse.json({
        results: [],
        gap_logged: true,
        gap_id: gapId,
        suggested_categories: suggestedCategories.map((c) => ({ id: c.id, name: c.name })),
        escalation: {
          message: "No articles found. A knowledge gap has been logged.",
          action: "escalate",
          contact_email: "support@zain.com",
        },
      });
    }
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
