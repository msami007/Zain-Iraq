import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";

// GET: List all teams for the organization
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
    
    let teams;
    if (role === "SuperAdmin" && !searchParams.get("tenant_id")) {
      // SuperAdmin fetching all teams across all tenants
      teams = await prisma.team.findMany({
        orderBy: { name: "asc" },
        include: {
          user_teams: {
            select: {
              user_id: true,
              user: {
                select: { id: true, name: true, email: true, role: true }
              }
            }
          }
        }
      });
    } else {
      const targetTenantId = role === "SuperAdmin" ? searchParams.get("tenant_id") || userTenantId : userTenantId;

      if (!targetTenantId) {
        return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
      }

      const db = getTenantDb(targetTenantId);
      teams = await db.team.findMany({
        orderBy: { name: "asc" },
        include: {
          user_teams: {
            select: {
              user_id: true,
              user: {
                select: { id: true, name: true, email: true, role: true }
              }
            }
          }
        }
      });
    }

    return NextResponse.json(teams);
  } catch (error: any) {
    console.error("GET Teams Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new team
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
    const { name, tenant_id: requestTenantId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    const targetTenantId = role === "SuperAdmin" ? requestTenantId || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const db = getTenantDb(targetTenantId);

    // Check if team name already exists
    const existing = await db.team.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists in this organization" }, { status: 409 });
    }

    const newTeam = await db.team.create({
      data: {
        tenant_id: targetTenantId,
        name: name.trim(),
      },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        tenant_id: targetTenantId,
        actor_id: userId,
        action: "Create Team",
        target_type: "Team",
        target_id: newTeam.id,
        target_label: `Team Created: ${newTeam.name}`,
        after: newTeam as any,
      },
    });

    return NextResponse.json(newTeam, { status: 201 });
  } catch (error: any) {
    console.error("POST Team Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Remove a team
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: userTenantId, id: userId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const teamId = searchParams.get("id");

    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    // Verify team exists and find its tenant ID
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Enforce that regular admins can only delete their own tenant's teams
    if (role !== "SuperAdmin" && team.tenant_id !== userTenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getTenantDb(team.tenant_id);
    await db.team.delete({
      where: { id: teamId },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        tenant_id: team.tenant_id,
        actor_id: userId,
        action: "Delete Team",
        target_type: "Team",
        target_id: teamId,
        target_label: `Team Deleted: ${team.name}`,
        before: team as any,
      },
    });

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error: any) {
    console.error("DELETE Team Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
