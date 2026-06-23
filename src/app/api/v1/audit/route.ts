import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";

// GET: Retrieve audit logs for the current tenant
export async function GET(req: NextRequest) {
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
    const targetTenantId = role === "SuperAdmin" ? searchParams.get("tenant_id") || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const db = getTenantDb(targetTenantId);

    // Filter audit logs for regular Admins to only show actions by members of their teams
    let actorFilter: any = undefined;
    if (role === "Admin" && userId) {
      const userTeams = await prisma.userTeam.findMany({
        where: { user_id: userId }
      });
      const teamIds = userTeams.map((ut: any) => ut.team_id);
      
      const teamMembers = await prisma.userTeam.findMany({
        where: { team_id: { in: teamIds } }
      });
      const memberIds = Array.from(new Set([...teamMembers.map((ut: any) => ut.user_id), userId]));
      
      actorFilter = {
        actor_id: { in: memberIds }
      };
    }

    const logs = await db.auditLog.findMany({
      where: actorFilter,
      orderBy: { created_at: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      take: 200 // Cap to last 200 audits for performance
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET Audit Logs Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
