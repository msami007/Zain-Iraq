import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { Channel } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { article_id, helpful, comment, channel } = body;

    if (!article_id || helpful === undefined) {
      return NextResponse.json(
        { error: "Article ID and helpful rating are required" },
        { status: 400 }
      );
    }

    // Resolve tenant_id: try to find the article in the root database to get its tenant_id
    // This allows unauthenticated guest feedback to be correctly scoped to the article's tenant.
    const article = await prisma.article.findUnique({
      where: { id: article_id },
      select: { tenant_id: true },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const tenantId = article.tenant_id;
    const db = getTenantDb(tenantId);

    const feedback = await db.articleFeedback.create({
      data: {
        tenant_id: tenantId,
        article_id,
        helpful: Boolean(helpful),
        comment: comment || null,
        channel: channel ? (channel as Channel) : Channel.default,
        session_ref: session?.user?.id || null,
      },
    });

    let actorId = session?.user?.id;
    if (!actorId) {
      const fallbackUser = await db.user.findFirst({
        where: { tenant_id: tenantId },
        select: { id: true },
      });
      actorId = fallbackUser?.id;
    }

    if (actorId) {
      await db.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_id: actorId,
          action: helpful ? "Mark Article Useful" : "Flag Article Missing",
          target_type: "Article",
          target_id: article_id,
          target_label: `Article Feedback: ${helpful ? "Helpful" : "Unhelpful"}${!session?.user ? " (Guest)" : ""}`,
          after: feedback as any,
        },
      });
    }

    return NextResponse.json(feedback, { status: 201 });
  } catch (error: any) {
    console.error("POST Feedback Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
