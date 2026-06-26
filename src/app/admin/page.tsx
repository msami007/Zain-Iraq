import { auth, signOut } from "@/lib/auth";
import { prisma, getTenantDb } from "@/lib/db";
import { redirect } from "next/navigation";
import AdminDeskWorkspace from "@/components/AdminDeskWorkspace";

export default async function AdminPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const { tenant_id: tenantId, name, email, role, id: userId } = session.user;

  // Enforce access control based on permissions matrix: Admin or SuperAdmin only
  if (role !== "Admin" && role !== "SuperAdmin") {
    redirect("/dashboard-redirect");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-zinc-900 font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-650">Organization Setup Required</h1>
          <p className="mt-2 text-zinc-500 font-semibold">The organization associated with your account could not be found.</p>
        </div>
      </div>
    );
  }

  const db = getTenantDb(tenantId);

  const [articles, categories, users, gaps] = await Promise.all([
    db.article.findMany({
      orderBy: { updated_at: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        variants: true,
        article_tags: {
          include: {
            tag: true,
          },
        },
        feedback: { select: { helpful: true } },
      },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { status: "Active" },
      orderBy: { name: "asc" },
    }),
    db.knowledgeGap.findMany({
      orderBy: { occurrences: "desc" },
      include: {
        reporter: { select: { name: true, email: true } },
        claimer: { select: { name: true } },
        resolving_article: { select: { id: true, title: true } },
        flagged_article: { select: { id: true, title: true } },
      },
    }),
  ]);

  // Serialization to plain JS objects for client component props
  const serializedArticles = articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    category_id: a.category_id,
    language: a.language,
    status: a.status,
    visibility: a.visibility,
    owner_id: a.owner_id,
    author_id: a.author_id,
    review_due: a.review_due ? a.review_due.toISOString() : null,
    updated_at: a.updated_at.toISOString(),
    category: a.category ? { id: a.category.id, name: a.category.name } : null,
    author: a.author ? { id: a.author.id, name: a.author.name, email: a.author.email } : null,
    owner: a.owner ? { id: a.owner.id, name: a.owner.name, email: a.owner.email } : null,
    variants: a.variants.map((v) => ({
      id: v.id,
      article_id: v.article_id,
      channel: v.channel,
      short_answer: v.short_answer,
      detailed_steps: v.detailed_steps,
      copy_ready_macro: v.copy_ready_macro,
      image_url: v.image_url,
      video_link: v.video_link,
      troubleshooting_flow: v.troubleshooting_flow || null,
    })),
    article_tags: a.article_tags.map((at) => ({
      tag: {
        id: at.tag.id,
        name: at.tag.name,
      },
    })),
    totalFeedback: a.feedback.length,
    helpfulRate: a.feedback.length > 0
      ? Math.round((a.feedback.filter((f) => f.helpful).length / a.feedback.length) * 100)
      : null,
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  const serializedGaps = gaps.map((g) => ({
    id: g.id,
    query_text: g.query_text,
    language: g.language,
    channel: g.channel,
    status: g.status,
    occurrences: g.occurrences,
    comment: g.comment || null,
    source: g.source || "agent",
    flagged_article_id: g.flagged_article_id || null,
    reported_by: g.reported_by,
    claimed_by: g.claimed_by,
    resolving_article_id: g.resolving_article_id,
    created_at: g.created_at.toISOString(),
    reporter: g.reporter ? { name: g.reporter.name, email: g.reporter.email } : null,
    claimer: g.claimer ? { name: g.claimer.name } : null,
    resolving_article: g.resolving_article ? { id: g.resolving_article.id, title: g.resolving_article.title } : null,
    flagged_article: g.flagged_article ? { id: g.flagged_article.id, title: g.flagged_article.title } : null,
  }));

  const brandingColor = (tenant.branding as any)?.primaryColor || "#09090B";

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col">
      <AdminDeskWorkspace
        initialArticles={serializedArticles}
        categories={serializedCategories}
        users={serializedUsers}
        currentUserId={userId}
        currentUserRole={role}
        tenantId={tenantId}
        initialGaps={serializedGaps}
        userName={name || undefined}
        userEmail={email || undefined}
        tenantName={tenant.name}
        brandingColor={brandingColor}
        signOutAction={handleSignOut}
      />
    </div>
  );
}
