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

  // Fetch users for assigning article ownership
  const users = await db.user.findMany({
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
    reported_by: g.reported_by,
    claimed_by: g.claimed_by,
    resolving_article_id: g.resolving_article_id,
    created_at: g.created_at.toISOString(),
    reporter: g.reporter ? { name: g.reporter.name } : null,
    claimer: g.claimer ? { name: g.claimer.name } : null,
    resolving_article: g.resolving_article ? { title: g.resolving_article.title } : null,
  }));

  const brandingColor = (tenant.branding as any)?.primaryColor || "#09090B";

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans">
      {/* Navbar */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <span 
                className="h-3 w-3 rounded-full border border-black/10 shadow-xs" 
                style={{ backgroundColor: brandingColor }} 
              />
              <h1 className="text-base font-extrabold tracking-tight text-zinc-950 flex items-center gap-2">
                {tenant.name}
                <span className="text-zinc-300 font-normal">|</span>
                <span className="text-zinc-650 font-bold text-xs uppercase tracking-wider">Admin Workspace</span>
              </h1>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-zinc-900">{name}</div>
                <div className="text-xs text-zinc-500 font-mono">{email}</div>
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

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Banner */}
        <div 
          className="rounded-xl border border-zinc-200 border-l-4 bg-white p-6 shadow-sm"
          style={{ borderLeftColor: brandingColor }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-950">Welcome, {name}!</h2>
              <p className="text-xs font-semibold text-zinc-500 mt-1">
                Manage articles, approve status changes, and resolve gaps for <strong className="text-zinc-800">{tenant.name}</strong>.
              </p>
            </div>
            <div>
              <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600">
                Tenant Key: <code className="ml-2 font-mono text-[10px] text-zinc-800">{tenant.id}</code>
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Workspace */}
        <AdminDeskWorkspace
          initialArticles={serializedArticles}
          categories={serializedCategories}
          users={serializedUsers}
          currentUserId={userId}
          currentUserRole={role}
          tenantId={tenantId}
          initialGaps={serializedGaps}
        />
      </main>
    </div>
  );
}
