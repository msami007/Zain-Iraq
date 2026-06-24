import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { GapStatus, Language, Channel } from "@prisma/client";

// Unauthenticated POST allowed for customer gap submissions (source: "customer")
export const dynamic = "force-dynamic";

// GET: Fetch knowledge gaps queue (scoped by tenant, Admin/SuperAdmin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role, id: userId } = session.user;

    const db = getTenantDb(tenantId);

    // Agents can only see their own submitted gaps
    if (role === "Agent") {
      const gaps = await db.knowledgeGap.findMany({
        where: { reported_by: userId },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          claimer: { select: { id: true, name: true, email: true } },
          resolving_article: { select: { id: true, title: true, slug: true } },
          flagged_article: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { created_at: "desc" },
      });
      return NextResponse.json(gaps);
    }

    // Admin/SuperAdmin see the full tenant queue
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") as GapStatus | null;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const dateFilter: any = {};
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam);
    }
    if (endDateParam) {
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const whereClause = {
      status: statusFilter || undefined,
      created_at: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    };

    // SuperAdmin queries across all tenants; Admin is scoped to their own tenant
    const queryClient = role === "SuperAdmin" ? prisma : db;

    const gaps = await queryClient.knowledgeGap.findMany({
      where: whereClause,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        claimer: { select: { id: true, name: true, email: true } },
        resolving_article: { select: { id: true, title: true, slug: true } },
        flagged_article: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { occurrences: "desc" },
    });

    return NextResponse.json(gaps);
  } catch (error: any) {
    console.error("GET Gaps Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Log/Create a knowledge gap — authenticated users OR customer (unauthenticated) submissions
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { query_text, language, channel, occurrences, comment, source, flagged_article_id, tenant_id: bodyTenantId } = body;

    if (!query_text || typeof query_text !== "string") {
      return NextResponse.json({ error: "Query text is required" }, { status: 400 });
    }

    // Unauthenticated customer submissions must supply tenant_id in body
    const isCustomer = !session?.user;
    const tenantId = session?.user?.tenant_id || bodyTenantId;
    const userId = session?.user?.id || null;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);
    const mappedLanguage = language === "ar" ? Language.ar : Language.en;
    const mappedChannel = channel ? (channel as Channel) : Channel.default;
    const reportedOccurrences = Math.max(1, parseInt(occurrences) || 1);
    const gapSource = source || (isCustomer ? "customer" : "agent");

    // Check if a gap with this query_text already exists and is not resolved/dismissed
    const existing = await db.knowledgeGap.findFirst({
      where: {
        query_text,
        tenant_id: tenantId,
        status: { in: [GapStatus.NEW, GapStatus.IN_PROGRESS] },
      },
    });

    if (existing) {
      const updated = await db.knowledgeGap.update({
        where: { id: existing.id },
        data: {
          occurrences: existing.occurrences + reportedOccurrences,
          // Append new comment if provided and gap doesn't have one yet
          ...(comment && !existing.comment ? { comment } : {}),
          // Always carry through article flag info when an agent explicitly flags an article
          ...(flagged_article_id ? { flagged_article_id, source: gapSource } : {}),
          // If gap was auto-created (no reporter), credit the agent who explicitly submitted it
          ...(!existing.reported_by && userId ? { reported_by: userId } : {}),
        },
      });
      return NextResponse.json(updated);
    }

    const newGap = await db.knowledgeGap.create({
      data: {
        tenant_id: tenantId,
        query_text,
        language: mappedLanguage,
        channel: mappedChannel,
        status: GapStatus.NEW,
        occurrences: reportedOccurrences,
        comment: comment || null,
        source: gapSource,
        flagged_article_id: flagged_article_id || null,
        reported_by: userId,
      },
    });

    return NextResponse.json(newGap, { status: 201 });
  } catch (error: any) {
    console.error("POST Gap Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Update gap status, claim, or link resolving article (Admin/SuperAdmin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role, id: userId } = session.user;

    // Enforce permission matrix: only Admin/SuperAdmin can resolve or edit gaps
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, resolving_article_id, claim } = body;

    if (!id) {
      return NextResponse.json({ error: "Gap ID is required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);
    // SuperAdmin can act on gaps from any tenant; Admin is scoped to their own
    const gapClient = role === "SuperAdmin" ? prisma : db;

    // Fetch the existing gap — SuperAdmin looks across all tenants
    const existing = await gapClient.knowledgeGap.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Knowledge gap not found" }, { status: 404 });
    }

    // Admin is restricted to their own tenant
    if (role === "Admin" && existing.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Knowledge gap not found" }, { status: 404 });
    }

    const gapTenantId = existing.tenant_id;
    const gapDb = getTenantDb(gapTenantId);

    const updateData: any = {};

    if (claim) {
      updateData.claimed_by = userId;
      updateData.status = GapStatus.IN_PROGRESS;
    } else if (status) {
      // Rule: cannot resolve without a linked article
      if (status === GapStatus.RESOLVED) {
        if (!resolving_article_id) {
          return NextResponse.json(
            { error: "Cannot resolve gap without linking a resolving article" },
            { status: 400 }
          );
        }
        // Verify the article exists in the gap's own tenant
        const article = await gapDb.article.findUnique({
          where: { id: resolving_article_id },
        });
        if (!article) {
          return NextResponse.json({ error: "Resolving article not found" }, { status: 404 });
        }
        updateData.resolving_article_id = resolving_article_id;
      } else if (status === GapStatus.IN_PROGRESS || status === GapStatus.NEW) {
        updateData.resolving_article_id = null;
      }
      updateData.status = status as GapStatus;
    }

    const updatedGap = await gapClient.knowledgeGap.update({
      where: { id },
      data: updateData,
      include: {
        reporter: { select: { name: true } },
        claimer: { select: { name: true } },
        resolving_article: { select: { title: true } },
      },
    });

    // Write audit log scoped to the gap's tenant
    await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: "Update Knowledge Gap",
        target_type: "KnowledgeGap",
        target_id: id,
        target_label: `Gap Status: ${updatedGap.status} (${updatedGap.query_text.slice(0, 30)})`,
        after: updatedGap as any,
      },
    });

    return NextResponse.json(updatedGap);
  } catch (error: any) {
    console.error("PUT Gap Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
