import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { Channel } from "@prisma/client";

export const dynamic = "force-dynamic";

// POST: Record an article analytics event — works for authenticated users AND public article views
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { article_id, action, label } = body;

    if (!article_id || !action || !label) {
      return NextResponse.json({ error: "Missing required analytics fields" }, { status: 400 });
    }

    // Resolve tenant: prefer session, fall back to x-tenant-id header
    const tenantId = session?.user?.tenant_id || req.headers.get("x-tenant-id") || null;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);

    // Resolve actor: authenticated user, or fall back to the tenant's first admin
    let actorId = session?.user?.id || null;
    if (!actorId) {
      const fallback = await db.user.findFirst({
        where: { tenant_id: tenantId },
        select: { id: true },
        orderBy: { created_at: "asc" },
      });
      actorId = fallback?.id || null;
    }
    if (!actorId) {
      // Can't write an audit log without an actor — silently succeed
      return NextResponse.json({ ok: true });
    }

    const log = await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: actorId,
        action,
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

    // Audience channel segmentation
    const channelParam = searchParams.get("channel") || "all";
    const customerChannels: Channel[] = ["default", "chatbot", "whatsapp"];
    const sqChannelWhere = channelParam === "agent"
      ? { channel: "agent" as Channel }
      : channelParam === "customer"
      ? { channel: { in: customerChannels } }
      : {};
    const fbChannelWhere = sqChannelWhere;
    const gapChannelWhere = sqChannelWhere;

    // Date boundaries
    const nowMs = Date.now();
    const todayStart = new Date(nowMs); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekAgo = new Date(nowMs - 7 * 86400000);
    const monthAgo = new Date(nowMs - 30 * 86400000);
    const twoMonthsAgo = new Date(nowMs - 60 * 86400000);

    // 1. Fetch total counts + deltas (run in parallel)
    const [
      totalArticles,
      articlesThisWeek,
      totalSearches,
      todaySearches,
      yesterdaySearches,
      totalGaps,
      gapsThisWeek,
      totalFeedback,
      helpfulFeedback,
      thisMonthFeedback,
      thisMonthHelpful,
      lastMonthFeedback,
      lastMonthHelpful,
    ] = await Promise.all([
      db.article.count(),
      db.article.count({ where: { created_at: { gte: weekAgo } } }),
      db.searchQuery.count({ where: { ...sqChannelWhere } }),
      db.searchQuery.count({ where: { ...sqChannelWhere, created_at: { gte: todayStart } } }),
      db.searchQuery.count({ where: { ...sqChannelWhere, created_at: { gte: yesterdayStart, lt: todayStart } } }),
      db.knowledgeGap.count({ where: { ...gapChannelWhere } }),
      db.knowledgeGap.count({ where: { ...gapChannelWhere, created_at: { gte: weekAgo } } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere, helpful: true } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere, created_at: { gte: monthAgo } } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere, helpful: true, created_at: { gte: monthAgo } } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere, created_at: { gte: twoMonthsAgo, lt: monthAgo } } }),
      db.articleFeedback.count({ where: { ...fbChannelWhere, helpful: true, created_at: { gte: twoMonthsAgo, lt: monthAgo } } }),
    ]);

    const helpfulRate = totalFeedback > 0 ? parseFloat(((helpfulFeedback / totalFeedback) * 100).toFixed(1)) : 0.0;

    // Search delta vs yesterday (percentage change)
    const searchVsYesterday = yesterdaySearches > 0
      ? parseFloat((((todaySearches - yesterdaySearches) / yesterdaySearches) * 100).toFixed(0))
      : null;

    // Helpful rate this month vs last month (pp delta)
    const helpfulRateThisMonth = thisMonthFeedback > 0 ? parseFloat(((thisMonthHelpful / thisMonthFeedback) * 100).toFixed(1)) : null;
    const helpfulRateLastMonth = lastMonthFeedback > 0 ? parseFloat(((lastMonthHelpful / lastMonthFeedback) * 100).toFixed(1)) : null;
    const helpfulRateDelta = helpfulRateThisMonth !== null && helpfulRateLastMonth !== null
      ? parseFloat((helpfulRateThisMonth - helpfulRateLastMonth).toFixed(1))
      : null;

    // 3. Fetch search average confidence (match score) — scoped to selected channel
    const avgConfidenceRaw = await db.searchQuery.aggregate({
      where: { ...sqChannelWhere },
      _avg: { top_match_score: true }
    });
    const avgConfidence = avgConfidenceRaw._avg.top_match_score 
      ? parseFloat((avgConfidenceRaw._avg.top_match_score * 100).toFixed(1)) 
      : 0.0;

    // 4. Fetch all article-related audit logs (actor.role used to segment customer vs agent views)
    const logs = await db.auditLog.findMany({
      where: {
        tenant_id: targetTenantId,
        target_type: "Article",
        action: { in: ["View Article", "Click Macro", "Use Macro"] },
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // 5. Fetch articles to link categories and feedbacks
    const articles = await db.article.findMany({
      include: {
        category: { select: { name: true } },
        feedback: { select: { helpful: true, channel: true } },
      }
    });

    // Filter logs by audience segment:
    //   customer = anonymous views (actor_id is null)
    //   agent    = views by Agent-role users
    //   all      = no filter
    const filteredLogs = channelParam === "customer"
      ? logs.filter((l) => l.actor_id === null)
      : channelParam === "agent"
      ? logs.filter((l) => l.actor?.role === "Agent")
      : logs;

    // Track views per article mapping
    const viewsMap: Record<string, number> = {};
    const clicksMap: Record<string, number> = {};
    filteredLogs.forEach((log) => {
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

    // 8. Recent Searches — scoped to selected channel
    const recentSearchesRaw = await db.searchQuery.findMany({
      where: { ...sqChannelWhere },
      orderBy: { created_at: "desc" },
      take: 5
    });
    const recentSearches = recentSearchesRaw.map(s => ({
      query: s.query_text,
      confidence: parseFloat((s.top_match_score * 100).toFixed(1)),
      date: s.created_at.toISOString()
    }));

    // 9. Articles Needing Attention (Low helpful rate) — segmented by channel
    const articlesNeedingAttention = articles
      .map(art => {
        const seg = channelParam === "all" ? art.feedback
          : art.feedback.filter(f => channelParam === "agent" ? f.channel === "agent" : customerChannels.includes(f.channel as any));
        const total = seg.length;
        const helpful = seg.filter(f => f.helpful).length;
        const pct = total > 0 ? parseFloat(((helpful / total) * 100).toFixed(1)) : 100.0;
        const views = viewsMap[art.id] || 0;
        return { id: art.id, title: art.title, views, helpfulPct: pct, totalFeedback: total };
      })
      .filter(a => a.totalFeedback > 0 && a.helpfulPct < 50.0)
      .sort((a, b) => a.helpfulPct - b.helpfulPct)
      .slice(0, 5);

    // 10. Top Articles by Views
    const topArticles = articles
      .map(art => {
        const seg = channelParam === "all" ? art.feedback
          : art.feedback.filter(f => channelParam === "agent" ? f.channel === "agent" : customerChannels.includes(f.channel as any));
        const total = seg.length;
        const helpful = seg.filter(f => f.helpful).length;
        const pct = total > 0 ? parseFloat(((helpful / total) * 100).toFixed(1)) : 0.0;
        const views = viewsMap[art.id] || 0;
        return { id: art.id, title: art.title, views, helpfulPct: pct };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // 11. Top Search Queries — scoped to selected channel
    const searchLogs = await db.searchQuery.findMany({ where: { ...sqChannelWhere }, select: { query_text: true } });
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

    // 12. Top Agents by KB Usage (always scoped to agent logs)
    const agentLogsForStats = logs.filter((l) => l.actor?.role === "Agent");
    const agentStats: Record<string, { id: string; name: string; email: string; views: number; clicks: number }> = {};
    agentLogsForStats.forEach((log) => {
      const actorId = log.actor_id;
      if (log.actor && actorId) {
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

    filteredLogs.forEach((log) => {
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
      const segmented = channelParam === "all"
        ? art.feedback
        : art.feedback.filter(f => channelParam === "agent"
            ? f.channel === "agent"
            : customerChannels.includes(f.channel as any));
      const total = segmented.length;
      const helpful = segmented.filter(f => f.helpful).length;
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
      channel: channelParam,
      totalViews,
      totalSearches,
      todaySearches,
      yesterdaySearches,
      searchVsYesterday,
      totalGaps,
      gapsThisWeek,
      totalArticles,
      articlesThisWeek,
      helpfulRate,
      helpfulRateThisMonth,
      helpfulRateDelta,
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
      articleViewCounts: viewsMap,
    });
  } catch (error: any) {
    console.error("GET Analytics Aggregates Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
