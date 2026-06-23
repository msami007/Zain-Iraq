import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb } from "@/lib/db";
import { Channel } from "@prisma/client";
import crypto from "crypto";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Fetch all guest links for an article (Admin/SuperAdmin only)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: articleId } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getTenantDb(tenantId);
    const links = await db.guestLink.findMany({
      where: {
        article_id: articleId,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(links);
  } catch (error: any) {
    console.error("GET Guest Links Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Generate a new guest link for a published article
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: articleId } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role, id: userId } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getTenantDb(tenantId);

    // Verify article exists and is Published
    const article = await db.article.findUnique({
      where: { id: articleId },
    });

    if (!article || article.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const body = await req.json();
    const { channel } = body;

    const token = crypto.randomUUID();

    const link = await db.guestLink.create({
      data: {
        tenant_id: tenantId,
        article_id: articleId,
        token: token,
        channel: channel ? (channel as Channel) : Channel.default,
        created_by: userId,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error: any) {
    console.error("POST Guest Link Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Revoke a guest link
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id: tenantId, role } = session.user;
    if (role !== "Admin" && role !== "SuperAdmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { link_id, revoked } = body;

    if (!link_id) {
      return NextResponse.json({ error: "Link ID is required" }, { status: 400 });
    }

    const db = getTenantDb(tenantId);
    const updated = await db.guestLink.update({
      where: { id: link_id },
      data: { revoked: Boolean(revoked) },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Guest Link Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
