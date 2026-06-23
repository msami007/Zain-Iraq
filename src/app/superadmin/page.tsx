import { auth, signOut } from "@/lib/auth";
import { prisma, getTenantDb } from "@/lib/db";
import { redirect } from "next/navigation";
import SuperAdminClient from "./SuperAdminClient";

export default async function SuperAdminPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "SuperAdmin") {
    redirect("/");
  }

  const tenantId = session.user.tenant_id;
  if (!tenantId) {
    redirect("/dashboard-redirect");
  }

  // Load all tenants and users (platform level)
  const tenants = await prisma.tenant.findMany({
    orderBy: { created_at: "desc" },
  });

  const users = await prisma.user.findMany({
    orderBy: { created_at: "desc" },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  // Map tenants to serializable objects
  const serializedTenants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    branding: t.branding || null,
    created_at: t.created_at.toISOString(),
  }));

  // Map users to serializable objects
  const serializedUsers = users.map((u) => ({
    id: u.id,
    tenant_id: u.tenant_id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    created_at: u.created_at.toISOString(),
    tenant: u.tenant ? { name: u.tenant.name, slug: u.tenant.slug } : undefined,
  }));

  // Query content database for the Super Admin's tenant
  const db = getTenantDb(tenantId);

  // Fetch articles with variants & version logs
  const articles = await db.article.findMany({
    orderBy: { updated_at: "desc" },
    include: {
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true } },
      variants: true,
    },
  });

  // Fetch categories
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch active users for assigning article ownership
  const activeUsers = await db.user.findMany({
    where: { status: "Active" },
    orderBy: { name: "asc" },
  });

  // Fetch knowledge gaps queue
  const gaps = await db.knowledgeGap.findMany({
    orderBy: { occurrences: "desc" },
    include: {
      reporter: { select: { name: true } },
      claimer: { select: { name: true } },
      resolving_article: { select: { title: true } },
    },
  });

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
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const serializedActiveUsers = activeUsers.map((u) => ({
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
    reported_by: g.reported_by,
    claimed_by: g.claimed_by,
    resolving_article_id: g.resolving_article_id,
    created_at: g.created_at.toISOString(),
    reporter: g.reporter ? { name: g.reporter.name } : null,
    claimer: g.claimer ? { name: g.claimer.name } : null,
    resolving_article: g.resolving_article ? { title: g.resolving_article.title } : null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-950 animate-pulse" />
              <h1 className="text-base font-extrabold tracking-tight text-zinc-950 flex items-center gap-2">
                Zain & OODI
                <span className="text-zinc-300 font-normal">|</span>
                <span className="text-zinc-650 font-bold text-xs uppercase tracking-wider">Super Admin Dashboard</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-zinc-900">{session.user.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{session.user.email}</div>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all shadow-sm"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <SuperAdminClient
          initialTenants={serializedTenants}
          initialUsers={serializedUsers}
          currentUserId={session.user.id}
          currentUserRole={session.user.role}
          tenantId={tenantId}
          initialArticles={serializedArticles}
          categories={serializedCategories}
          activeUsers={serializedActiveUsers}
          initialGaps={serializedGaps}
        />
      </main>
    </div>
  );
}
