import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

// GET: List all custom workflow routes
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: userTenantId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin" && role !== "Agent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const targetTenantId = role === "SuperAdmin" ? searchParams.get("tenant_id") || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const isActiveParam = searchParams.get("is_active");
    const isActiveFilter = isActiveParam === null ? undefined : isActiveParam === "true";

    const db = getTenantDb(targetTenantId);
    const workflows = await db.workflowRoute.findMany({
      where: isActiveFilter !== undefined ? { is_active: isActiveFilter } : undefined,
      orderBy: { name: "asc" },
      include: {
        steps: {
          orderBy: { step_number: "asc" },
          include: {
            team: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(workflows);
  } catch (error: any) {
    console.error("GET Workflows Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new custom workflow route with steps
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: userTenantId, id: userId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, steps, tenant_id: requestTenantId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Workflow must have at least one step" }, { status: 400 });
    }

    const targetTenantId = role === "SuperAdmin" ? requestTenantId || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const db = getTenantDb(targetTenantId);

    // Validate steps format and check constraints
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.name || typeof step.name !== "string" || !step.name.trim()) {
        return NextResponse.json({ error: `Step ${i + 1} name is required` }, { status: 400 });
      }
      if (!step.role_restriction || !Object.values(UserRole).includes(step.role_restriction)) {
        return NextResponse.json({ error: `Step ${i + 1} has an invalid role restriction` }, { status: 400 });
      }
    }

    // Validate team_id and user_id references belong to this tenant
    const stepTeamIds = steps.filter((s: any) => s.team_id).map((s: any) => s.team_id);
    const stepUserIds = steps.filter((s: any) => s.user_id).map((s: any) => s.user_id);

    if (stepTeamIds.length > 0) {
      const teams = await db.team.findMany({ where: { id: { in: stepTeamIds } } });
      if (teams.length !== stepTeamIds.length) {
        return NextResponse.json({ error: "One or more step team IDs are invalid or do not belong to this organization" }, { status: 400 });
      }
    }
    if (stepUserIds.length > 0) {
      const users = await db.user.findMany({ where: { id: { in: stepUserIds } } });
      if (users.length !== stepUserIds.length) {
        return NextResponse.json({ error: "One or more step user IDs are invalid or do not belong to this organization" }, { status: 400 });
      }
    }

    // Create workflow route and its steps inside a transaction
    const newRoute = await db.$transaction(async (tx) => {
      const route = await tx.workflowRoute.create({
        data: {
          tenant_id: targetTenantId,
          name: name.trim(),
          description: description?.trim() || null,
        },
      });

      // Insert sequential steps
      await tx.workflowStep.createMany({
        data: steps.map((s: any, idx: number) => ({
          route_id: route.id,
          step_number: idx + 1,
          name: s.name.trim(),
          role_restriction: s.role_restriction as UserRole,
          team_id: s.team_id || null,
          user_id: s.user_id || null,
        })),
      });

      return route;
    });

    // Fetch full workflow details with steps to return
    const fullWorkflow = await db.workflowRoute.findUnique({
      where: { id: newRoute.id },
      include: {
        steps: {
          orderBy: { step_number: "asc" },
          include: {
            team: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        tenant_id: targetTenantId,
        actor_id: userId,
        action: "Create Workflow Route",
        target_type: "WorkflowRoute",
        target_id: newRoute.id,
        target_label: `Workflow Created: ${newRoute.name}`,
        after: fullWorkflow as any,
      },
    });

    return NextResponse.json(fullWorkflow, { status: 201 });
  } catch (error: any) {
    console.error("POST Workflow Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
