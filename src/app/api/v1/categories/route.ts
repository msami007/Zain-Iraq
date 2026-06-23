import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";

// POST: Create a new category
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
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const targetTenantId = role === "SuperAdmin" ? requestTenantId || userTenantId : userTenantId;

    if (!targetTenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const db = getTenantDb(targetTenantId);

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    // Check if category name or slug already exists under this tenant
    const existing = await db.category.findFirst({
      where: {
        OR: [
          { name: { equals: trimmedName, mode: "insensitive" } },
          { slug: slug }
        ]
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    const newCategory = await db.category.create({
      data: {
        tenant_id: targetTenantId,
        name: trimmedName,
        slug: slug,
      },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        tenant_id: targetTenantId,
        actor_id: userId,
        action: "Create Category",
        target_type: "Category",
        target_id: newCategory.id,
        target_label: `Category Created: ${newCategory.name}`,
        after: newCategory as any,
      },
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    console.error("POST Category Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
