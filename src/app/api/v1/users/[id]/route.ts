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
    const { status, role } = body;

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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        tenant_id: session.user.tenant_id,
        actor_id: session.user.id,
        action: status !== undefined ? "Update User Status" : "Update User Role",
        target_type: "User",
        target_id: updated.id,
        target_label: updated.email,
        before: { role: before.role, status: before.status } as any,
        after: { role: updated.role, status: updated.status } as any,
      },
    });

    return NextResponse.json({
      id: updated.id,
      role: updated.role,
      status: updated.status,
    });
  } catch (error: any) {
    console.error("PATCH User Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
