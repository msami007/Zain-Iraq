import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TenantStatus } from "@prisma/client";

// Guard: Only SuperAdmin can manage organizations
async function isSuperAdmin() {
  const session = await auth();
  return session?.user?.role === "SuperAdmin";
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden: SuperAdmin access required" }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(tenants);
  } catch (error: any) {
    console.error("GET Orgs Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden: SuperAdmin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, branding } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and Slug are required" }, { status: 400 });
    }

    // Format slug
    const formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Check if slug is taken
    const existing = await prisma.tenant.findUnique({
      where: { slug: formattedSlug },
    });

    if (existing) {
      return NextResponse.json({ error: "Organization slug is already in use" }, { status: 409 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: formattedSlug,
        status: TenantStatus.Active,
        branding: branding || null,
        created_by: session.user.id,
      },
    });

    // Write audit log entry
    await prisma.auditLog.create({
      data: {
        tenant_id: session.user.tenant_id,
        actor_id: session.user.id,
        action: "Create Organization",
        target_type: "Tenant",
        target_id: tenant.id,
        target_label: `Tenant Created: ${tenant.name}`,
        after: tenant as any,
      },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (error: any) {
    console.error("POST Org Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
