import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db";
import { AnnouncementType } from "@prisma/client";

// GET: Active announcements scoped to the caller's tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tenant_id: tenantId } = session.user;
    const db = getTenantDb(tenantId);
    const now = new Date();

    const announcements = await db.announcement.findMany({
      where: {
        active: true,
        OR: [{ starts_at: null }, { starts_at: { lte: now } }],
        AND: [
          { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
        ],
      },
      orderBy: { created_at: "desc" },
      include: { creator: { select: { name: true } } },
    });

    return NextResponse.json(announcements);
  } catch (error: any) {
    console.error("GET Announcements Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create announcement — Admin/SuperAdmin only
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tenant_id: tenantId, role, id: userId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, type, audience, team_id, starts_at, ends_at } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);

    const announcement = await db.announcement.create({
      data: {
        tenant_id: tenantId,
        title,
        body: message,
        type: (type as AnnouncementType) || AnnouncementType.banner,
        audience: audience || "all",
        team_id: team_id || null,
        starts_at: starts_at ? new Date(starts_at) : null,
        ends_at: ends_at ? new Date(ends_at) : null,
        created_by: userId,
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error: any) {
    console.error("POST Announcement Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Deactivate (soft-delete) announcement — Admin/SuperAdmin only
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tenant_id: tenantId, role } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const db = getTenantDb(tenantId);

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing || existing.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.announcement.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Announcement Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
