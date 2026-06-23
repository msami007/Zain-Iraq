import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, UserStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
    }

    const body = await req.json();
    const { status, role, team_ids } = body;

    const updateData: Partial<{ status: UserStatus; role: UserRole }> = {};

    if (status !== undefined) {
      if (!Object.values(UserStatus).includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status as UserStatus;
    }

    if (role !== undefined) {
      if (!Object.values(UserRole).includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = role as UserRole;
    }

    const before = await prisma.user.findUnique({ 
      where: { id },
      include: {
        user_teams: { select: { team_id: true } }
      }
    });
    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Run updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      let updated: any = before;
      if (Object.keys(updateData).length > 0) {
        updated = await tx.user.update({
          where: { id },
          data: updateData,
        });
      }

      if (team_ids !== undefined && Array.isArray(team_ids)) {
        // Clear existing mappings
        await tx.userTeam.deleteMany({
          where: { user_id: id }
        });

        if (team_ids.length > 0) {
          await tx.userTeam.createMany({
            data: team_ids.map((tid: string) => ({
              user_id: id,
              team_id: tid,
              tenant_id: before.tenant_id,
            })),
          });
        }
      }

      return updated;
    });

    const updatedWithTeams = await prisma.user.findUnique({
      where: { id },
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

    await prisma.auditLog.create({
      data: {
        tenant_id: session.user.tenant_id,
        actor_id: session.user.id,
        action: "Update User Account",
        target_type: "User",
        target_id: result.id,
        target_label: result.email,
        before: { 
          role: before.role, 
          status: before.status, 
          teams: before.user_teams.map(ut => ut.team_id) 
        } as any,
        after: { 
          role: result.role, 
          status: result.status, 
          teams: updatedWithTeams?.user_teams.map(ut => ut.team.id) || [] 
        } as any,
      },
    });

    return NextResponse.json({
      id: result.id,
      role: result.role,
      status: result.status,
      user_teams: updatedWithTeams?.user_teams || [],
    });
  } catch (error: any) {
    console.error("PATCH User Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
