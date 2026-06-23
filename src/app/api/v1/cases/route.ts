import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db";
import { CaseStatus } from "@prisma/client";

// GET: Fetch case queue (scoped by tenant, authenticated users only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId } = session.user;
    const db = getTenantDb(tenantId);
    
    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") as CaseStatus | null;

    const cases = await db.chatCase.findMany({
      where: {
        status: statusFilter || undefined,
      },
      include: {
        agent: { select: { id: true, name: true, email: true } },
        resolving_article: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { wait_started_at: "asc" },
    });

    return NextResponse.json(cases);
  } catch (error: any) {
    console.error("GET Cases Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Claim/Assign case or Resolve case (Agents only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role, id: userId } = session.user;

    // Enforce permission matrix: ONLY Customer Support Agents can claim/resolve cases!
    if (role !== "Agent") {
      return NextResponse.json(
        { error: "Forbidden: Case operations are restricted to Customer Support Agents only." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, claim, status, resolving_article_id } = body;

    if (!id) {
      return NextResponse.json({ error: "Case ID is required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);

    // Fetch the existing case to verify ownership & tenant
    const existing = await db.chatCase.findUnique({
      where: { id },
    });

    if (!existing || existing.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (claim) {
      if (existing.status !== CaseStatus.waiting) {
        return NextResponse.json({ error: "Case is already claimed or resolved" }, { status: 400 });
      }
      updateData.assigned_agent_id = userId;
      updateData.status = CaseStatus.active;
    } else if (status) {
      if (status === CaseStatus.resolved) {
        if (!resolving_article_id) {
          return NextResponse.json(
            { error: "Cannot resolve a case without linking a resolving article ID" },
            { status: 400 }
          );
        }
        // Verify resolving article exists in same tenant
        const article = await db.article.findUnique({
          where: { id: resolving_article_id },
        });
        if (!article || article.tenant_id !== tenantId) {
          return NextResponse.json({ error: "Resolving article not found" }, { status: 404 });
        }

        updateData.resolving_article_id = resolving_article_id;
        updateData.resolved_at = new Date();
      }
      updateData.status = status as CaseStatus;
    }

    const updatedCase = await db.chatCase.update({
      where: { id },
      data: updateData,
      include: {
        agent: { select: { name: true } },
        resolving_article: { select: { title: true } },
      },
    });

    // Log the case resolution/update in the audit log
    await db.auditLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        action: claim ? "Claim Case" : "Resolve Case",
        target_type: "ChatCase",
        target_id: id,
        target_label: `Case status changed to ${updatedCase.status} for ${updatedCase.customer_name}`,
        after: updatedCase as any,
      },
    });

    return NextResponse.json(updatedCase);
  } catch (error: any) {
    console.error("PUT Case Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
