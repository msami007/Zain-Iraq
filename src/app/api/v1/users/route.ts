import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, getTenantDb } from "@/lib/db";
import { UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id } = session.user;

    // SuperAdmin can view all users, Admin can view users of their own tenant
    if (role === "SuperAdmin") {
      const users = await prisma.user.findMany({
        orderBy: { created_at: "desc" },
        include: {
          tenant: {
            select: { name: true, slug: true },
          },
        },
      });
      return NextResponse.json(users);
    } else if (role === "Admin") {
      const db = getTenantDb(tenant_id);
      const users = await db.user.findMany({
        orderBy: { created_at: "desc" },
      });
      return NextResponse.json(users);
    } else {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
  } catch (error: any) {
    console.error("GET Users Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, tenant_id: adminTenantId, id: adminUserId } = session.user;

    // Only Admin and SuperAdmin can create/invite users
    if (role !== "SuperAdmin" && role !== "Admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role: targetRole, tenant_id: targetTenantId, team_ids } = body;

    if (!name || !email || !password || !targetRole) {
      return NextResponse.json({ error: "Name, Email, Password, and Role are required" }, { status: 400 });
    }

    // Determine target tenant: Admin is restricted to their own tenant, SuperAdmin can select
    const finalTenantId = role === "SuperAdmin" ? targetTenantId || adminTenantId : adminTenantId;

    if (!finalTenantId) {
      return NextResponse.json({ error: "Organization tenant_id is required" }, { status: 400 });
    }

    // Validate email uniqueness on that tenant
    const existing = await prisma.user.findFirst({
      where: {
        tenant_id: finalTenantId,
        email,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists in the organization" }, { status: 409 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenant_id: finalTenantId,
          name,
          email,
          password_hash: passwordHash,
          role: targetRole as UserRole,
          status: UserStatus.Active, // Active immediately for testability
        },
      });

      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        await tx.userTeam.createMany({
          data: team_ids.map((tid: string) => ({
            user_id: u.id,
            team_id: tid,
            tenant_id: finalTenantId,
          })),
        });
      }

      return u;
    });

    const userWithTeams = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        user_teams: {
          select: {
            team: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Write audit log entry
    await prisma.auditLog.create({
      data: {
        tenant_id: adminTenantId,
        actor_id: adminUserId,
        action: "Invite User",
        target_type: "User",
        target_id: user.id,
        target_label: `User Created: ${user.email} (${user.role})`,
        after: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          teams: userWithTeams?.user_teams.map(ut => ut.team.id) || []
        } as any,
      },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      status: user.status,
      user_teams: userWithTeams?.user_teams || [],
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
