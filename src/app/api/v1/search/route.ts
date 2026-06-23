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

    // Team access filter
    let teamFilter: any = {};
    if (!session || !session.user) {
      teamFilter = { visibility: Visibility.PUBLIC };
    } else if (session.user.role !== "SuperAdmin") {
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

    const cleanQuery = query.trim();
    const words = cleanQuery.split(/\s+/).filter((w) => w.length > 1);

    const searchConditions: any[] = [
      { title: { contains: cleanQuery, mode: "insensitive" } },
      { slug: { contains: cleanQuery, mode: "insensitive" } },
      { category: { name: { contains: cleanQuery, mode: "insensitive" } } },
    ];

    // Make query flexible by matching individual words too
    for (const word of words) {
      searchConditions.push(
        { title: { contains: word, mode: "insensitive" } },
        { slug: { contains: word, mode: "insensitive" } },
        { category: { name: { contains: word, mode: "insensitive" } } }
      );
    }

    const whereClause: any = {
      language: mappedLanguage,
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
      },
    });

    const results = articles.map((article) => {
      const titleLower = article.title.toLowerCase();
      const queryLower = cleanQuery.toLowerCase();

      let score = 0.1; // Base match score

      // 1. Exact Match: 1.0
      if (titleLower === queryLower) {
        score = 1.0;
      } 
      // 2. Starts With: 0.75
      else if (titleLower.startsWith(queryLower)) {
        score = 0.75;
      } 
      // 3. Contains contiguous full phrase: 0.5
      else if (titleLower.includes(queryLower)) {
        score = 0.5;
      } 
      // 4. Matches individual words: score proportional to match count
      else if (words.length > 0) {
        const matchingWords = words.filter((w) =>
          titleLower.includes(w.toLowerCase()) || 
          article.category?.name.toLowerCase().includes(w.toLowerCase())
        );
        score = 0.1 + (matchingWords.length / words.length) * 0.35; // Maximum word match score is 0.45
      }

      return {
        article_id: article.id,
        title: article.title,
        category: article.category.name,
        match_score: Number(score.toFixed(3)),
        status: article.status,
        language: article.language,
      };
    });

    // Sort results by score desc
    results.sort((a, b) => b.match_score - a.match_score);

    // Log the search query in database
    await db.searchQuery.create({
      data: {
        tenant_id: tenantId,
        query_text: query,
        language: mappedLanguage,
        channel: mappedChannel,
        user_id: session?.user?.id || null,
        results_count: results.length,
        top_match_score: results.length > 0 ? results[0].match_score : 0.0,
      },
    });

    if (results.length > 0) {
      return NextResponse.json({
        results,
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
      if (existingGap) {
        // Increment occurrences
        const updated = await db.knowledgeGap.update({
          where: { id: existingGap.id },
          data: { occurrences: existingGap.occurrences + 1 },
        });
        gapId = updated.id;
      } else {
        // Create new gap
        const created = await db.knowledgeGap.create({
          data: {
            tenant_id: tenantId,
            query_text: query,
            language: mappedLanguage,
            channel: mappedChannel,
            status: GapStatus.NEW,
            reported_by: session?.user?.id || null,
          },
        });
        gapId = created.id;
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
