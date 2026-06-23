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

// GET: Retrieve aggregated analytics for the admin dashboard
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

    // Fetch all article-related audit logs to aggregate in memory (or db if supported)
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

    // 1. Group by Article ID to get top articles by views/clicks
    const articleStats: Record<string, { id: string; label: string; views: number; clicks: number }> = {};
    // 2. Group by Actor (Agent) to see usage counts
    const agentStats: Record<string, { id: string; name: string; email: string; views: number; clicks: number }> = {};
    // 3. Daily trends (past 7 days)
    const dailyTrend: Record<string, { date: string; views: number; clicks: number }> = {};

    // Initialize last 7 days for trend
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dailyTrend[dateStr] = { date: dateStr, views: 0, clicks: 0 };
    }

    logs.forEach((log) => {
      // Article Stats
      if (!articleStats[log.target_id]) {
        articleStats[log.target_id] = { id: log.target_id, label: log.target_label, views: 0, clicks: 0 };
      }
      if (log.action === "View Article") {
        articleStats[log.target_id].views++;
      } else {
        articleStats[log.target_id].clicks++;
      }

      // Agent Stats
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

      // Daily Trend
      const logDateStr = new Date(log.created_at).toISOString().split("T")[0];
      if (dailyTrend[logDateStr]) {
        if (log.action === "View Article") {
          dailyTrend[logDateStr].views++;
        } else {
          dailyTrend[logDateStr].clicks++;
        }
      }
    });

    // Format top lists
    const topArticles = Object.values(articleStats)
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 10);

    const topAgents = Object.values(agentStats)
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 10);

    const trendList = Object.values(dailyTrend);

    return NextResponse.json({
      topArticles,
      topAgents,
      dailyTrend: trendList,
    });
  } catch (error: any) {
    console.error("GET Analytics Aggregates Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
