import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db";

// GET: Retrieve audit logs for the current tenant
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
    const logs = await db.auditLog.findMany({
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
