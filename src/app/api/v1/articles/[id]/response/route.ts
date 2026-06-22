import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenantDb, prisma } from "@/lib/db";
import { Channel } from "@prisma/client";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    let tenantId = session?.user?.tenant_id;

    // Resolve tenant for guest requests
    if (!tenantId) {
      const headerTenant = req.headers.get("x-tenant-id");
      if (headerTenant) {
        tenantId = headerTenant;
      } else {
        // Fallback to Zain tenant ID from slug
        const zain = await prisma.tenant.findFirst({ where: { slug: "zain" } });
        if (!zain) {
          return NextResponse.json({ error: "Tenant setup required" }, { status: 500 });
        }
        tenantId = zain.id;
      }
    }

    const db = getTenantDb(tenantId);
    
    // Fetch article with variants under the current tenant context
    const article = await db.article.findFirst({
      where: { id },
      include: {
        variants: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Get requested channel
    const searchParams = req.nextUrl.searchParams;
    const requestedChannel = searchParams.get("channel") || "default";

    // Find requested variant
    let variant = article.variants.find((v) => v.channel === requestedChannel);
    let isFallback = false;

    if (!variant && requestedChannel !== "default") {
      // Fallback to default
      variant = article.variants.find((v) => v.channel === "default");
      isFallback = true;
    }

    // Prepare response fields (blank channel variant fallback)
    return NextResponse.json({
      article_id: article.id,
      title: article.title,
      language: article.language,
      channel: variant?.channel || "default",
      fallback_used: isFallback,
      short_answer: variant?.short_answer || "",
      detailed_steps: variant?.detailed_steps || "",
      copy_ready_macro: variant?.copy_ready_macro || "",
      image_url: variant?.image_url || "",
      video_link: variant?.video_link || "",
      troubleshooting_flow: variant?.troubleshooting_flow || null,
      feedback_endpoint: `/api/v1/feedback`,
    });
  } catch (error: any) {
    console.error("Article Response API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
