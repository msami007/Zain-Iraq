import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db";

// POST: Record an article analytics event (e.g. view, click macro)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, id: userId } = session.user;
    const body = await req.json();
    const { article_id, action, label } = body;

    if (!article_id || !action || !label) {
      return NextResponse.json({ error: "Missing required analytics fields" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);

    // Record this in the auditLog table
    const log = await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: action, // e.g. "View Article" or "Click Macro"
        target_type: "Article",
        target_id: article_id,
        target_label: label,
      },
    });

    return NextResponse.json(log);
  } catch (error: any) {
    console.error("POST Analytics Event Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// GET: Retrieve aggregated analytics for the admin/superadmin dashboard
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: userTenantId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const targetTenantId = role === "SuperAdmin" ? searchParams.get("tenant_id") || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const db = getTenantDb(targetTenantId);

    // 1. Fetch total counts
    const totalSearches = await db.searchQuery.count();
    const totalGaps = await db.knowledgeGap.count();
    const totalArticles = await db.article.count();

    // 2. Fetch feedback helpful rate
    const totalFeedback = await db.articleFeedback.count();
    const helpfulFeedback = await db.articleFeedback.count({ where: { helpful: true } });
    const helpfulRate = totalFeedback > 0 ? parseFloat(((helpfulFeedback / totalFeedback) * 100).toFixed(1)) : 0.0;

    // 3. Fetch search average confidence (match score)
    const avgConfidenceRaw = await db.searchQuery.aggregate({
      _avg: { top_match_score: true }
    });
    const avgConfidence = avgConfidenceRaw._avg.top_match_score 
      ? parseFloat((avgConfidenceRaw._avg.top_match_score * 100).toFixed(1)) 
      : 0.0;

    // 4. Fetch all article-related audit logs
    const logs = await db.auditLog.findMany({
      where: {
        tenant_id: targetTenantId,
        target_type: "Article",
        action: { in: ["View Article", "Click Macro", "Use Macro"] },
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    // 5. Fetch articles to link categories and feedbacks
    const articles = await db.article.findMany({
      include: {
        category: { select: { name: true } },
        feedback: { select: { helpful: true } }
      }
    });

    // Track views per article mapping
    const viewsMap: Record<string, number> = {};
    const clicksMap: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.action === "View Article") {
        viewsMap[log.target_id] = (viewsMap[log.target_id] || 0) + 1;
      } else {
        clicksMap[log.target_id] = (clicksMap[log.target_id] || 0) + 1;
      }
    });

    const totalViews = Object.values(viewsMap).reduce((a, b) => a + b, 0);

    // 6. Views by Category
    const categoryViews: Record<string, number> = {};
    articles.forEach((art) => {
      const catName = art.category?.name || "General";
      const views = viewsMap[art.id] || 0;
      categoryViews[catName] = (categoryViews[catName] || 0) + views;
    });
    const viewsByCategory = Object.entries(categoryViews).map(([name, count]) => ({ name, count }));

    // 7. Content Breakdown (status distribution)
    const statusCounts: Record<string, number> = {
      Draft: 0,
      InReview: 0,
      Approved: 0,
      Published: 0,
      Archived: 0
    };
    articles.forEach((art) => {
      statusCounts[art.status] = (statusCounts[art.status] || 0) + 1;
    });
    const contentBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // 8. Recent Searches
    const recentSearchesRaw = await db.searchQuery.findMany({
      orderBy: { created_at: "desc" },
      take: 5
    });
    const recentSearches = recentSearchesRaw.map(s => ({
      query: s.query_text,
      confidence: parseFloat((s.top_match_score * 100).toFixed(1)),
      date: s.created_at.toISOString()
    }));

    // 9. Articles Needing Attention (Low helpful rate)
    const articlesNeedingAttention = articles
      .map(art => {
        const total = art.feedback.length;
        const helpful = art.feedback.filter(f => f.helpful).length;
        const pct = total > 0 ? parseFloat(((helpful / total) * 100).toFixed(1)) : 100.0;
        const views = viewsMap[art.id] || 0;
        return {
          id: art.id,
          title: art.title,
          views,
          helpfulPct: pct,
          totalFeedback: total
        };
      })
      .filter(a => a.totalFeedback > 0 && a.helpfulPct < 50.0)
      .sort((a, b) => a.helpfulPct - b.helpfulPct)
      .slice(0, 5);

    // 10. Top Articles by Views
    const topArticles = articles
      .map(art => {
        const total = art.feedback.length;
        const helpful = art.feedback.filter(f => f.helpful).length;
        const pct = total > 0 ? parseFloat(((helpful / total) * 100).toFixed(1)) : 0.0;
        const views = viewsMap[art.id] || 0;
        return {
          id: art.id,
          title: art.title,
          views,
          helpfulPct: pct
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // 11. Top Search Queries
    const searchLogs = await db.searchQuery.findMany({ select: { query_text: true } });
    const queryCounts: Record<string, number> = {};
    searchLogs.forEach(q => {
      const text = q.query_text.trim();
      if (text) {
        queryCounts[text] = (queryCounts[text] || 0) + 1;
      }
    });
    const topSearchQueries = Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 12. Top Agents by KB Usage
    const agentStats: Record<string, { id: string; name: string; email: string; views: number; clicks: number }> = {};
    logs.forEach((log) => {
      const actorId = log.actor_id;
      if (log.actor) {
        if (!agentStats[actorId]) {
          agentStats[actorId] = {
            id: actorId,
            name: log.actor.name,
            email: log.actor.email,
            views: 0,
            clicks: 0,
          };
        }
        if (log.action === "View Article") {
          agentStats[actorId].views++;
        } else {
          agentStats[actorId].clicks++;
        }
      }
    });
    const topAgents = Object.values(agentStats)
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 5);

    // 13. Daily Trend (Access Trends)
    const dailyTrend: Record<string, { date: string; views: number; clicks: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dailyTrend[dateStr] = { date: dateStr, views: 0, clicks: 0 };
    }

    logs.forEach((log) => {
      const logDateStr = new Date(log.created_at).toISOString().split("T")[0];
      if (dailyTrend[logDateStr]) {
        if (log.action === "View Article") {
          dailyTrend[logDateStr].views++;
        } else {
          dailyTrend[logDateStr].clicks++;
        }
      }
    });

    const trendList = Object.values(dailyTrend);

    // Compute topHelpful, mostViewed, and needsAttention for Admin Dashboard
    let topHelpful: any = null;
    let mostViewed: any = null;
    let needsAttention: any = null;

    const processedArticles = articles.map(art => {
      const total = art.feedback.length;
      const helpful = art.feedback.filter(f => f.helpful).length;
      const unhelpful = total - helpful;
      const pct = total > 0 ? parseFloat(((helpful / total) * 100).toFixed(1)) : 100.0;
      const views = viewsMap[art.id] || 0;
      return {
        id: art.id,
        title: art.title,
        views,
        helpfulPct: pct,
        helpfulCount: helpful,
        unhelpfulCount: unhelpful,
        totalFeedback: total
      };
    });

    if (processedArticles.length > 0) {
      // 1. Top Helpful: highest helpfulPct where totalFeedback > 0.
      const helpfulCandidates = processedArticles.filter(a => a.totalFeedback > 0);
      if (helpfulCandidates.length > 0) {
        const sortedHelpful = [...helpfulCandidates].sort((a, b) => {
          if (b.helpfulPct !== a.helpfulPct) return b.helpfulPct - a.helpfulPct;
          if (b.views !== a.views) return b.views - a.views;
          return b.helpfulCount - a.helpfulCount;
        });
        topHelpful = sortedHelpful[0];
      } else {
        // Fallback to highest views
        const sortedViews = [...processedArticles].sort((a, b) => b.views - a.views);
        topHelpful = {
          id: sortedViews[0].id,
          title: sortedViews[0].title,
          views: sortedViews[0].views,
          helpfulPct: 100.0,
          helpfulCount: 0,
          unhelpfulCount: 0,
          totalFeedback: 0
        };
      }

      // 2. Most Viewed: highest views
      const sortedViews = [...processedArticles].sort((a, b) => {
        if (b.views !== a.views) return b.views - a.views;
        return b.helpfulPct - a.helpfulPct;
      });
      mostViewed = sortedViews[0];

      // 3. Needs Attention: lowest helpfulPct where helpfulPct < 100
      const candidatesLowHelpful = processedArticles.filter(a => a.totalFeedback > 0 && a.helpfulPct < 100.0);
      if (candidatesLowHelpful.length > 0) {
        const sortedUnhelpful = [...candidatesLowHelpful].sort((a, b) => {
          if (a.helpfulPct !== b.helpfulPct) return a.helpfulPct - b.helpfulPct;
          if (b.unhelpfulCount !== a.unhelpfulCount) return b.unhelpfulCount - a.unhelpfulCount;
          return b.views - a.views;
        });
        needsAttention = sortedUnhelpful[0];
      } else {
        // Fallback to null
        needsAttention = null;
      }
    }

    return NextResponse.json({
      totalViews,
      totalSearches,
      totalGaps,
      totalArticles,
      helpfulRate,
      avgConfidence,
      viewsByCategory,
      contentBreakdown,
      recentSearches,
      articlesNeedingAttention,
      topArticles,
      topSearchQueries,
      topAgents,
      dailyTrend: trendList,
      topHelpful,
      mostViewed,
      needsAttention,
    });
  } catch (error: any) {
    console.error("GET Analytics Aggregates Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
