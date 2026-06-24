import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleStatus, Visibility } from "@prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CategoryPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  const tenant = await prisma.tenant.findUnique({ where: { id: category.tenant_id } });

  // Role-scoped back navigation
  const backHref = !user
    ? "/"
    : user.role === "SuperAdmin" || user.role === "Admin"
    ? "/admin"
    : "/agent";
  const backLabel = !user
    ? "Back to Home"
    : user.role === "SuperAdmin" || user.role === "Admin"
    ? "Admin Desk"
    : "Agent Desk";

  // Visibility and status rules mirror the articles list API
  const statusClause = user ? undefined : ArticleStatus.Published;
  const teamFilter: any = user
    ? user.role === "SuperAdmin"
      ? {}
      : {
          OR: [
            { visibility: Visibility.PUBLIC },
            {
              visibility: Visibility.PRIVATE,
              article_teams: {
                some: {
                  team_id: {
                    in: (
                      await prisma.userTeam.findMany({ where: { user_id: user.id } })
                    ).map((ut) => ut.team_id),
                  },
                },
              },
            },
          ],
        }
    : { visibility: Visibility.PUBLIC };

  const articles = await prisma.article.findMany({
    where: { category_id: id, status: statusClause, ...teamFilter },
    include: { author: { select: { name: true } } },
    orderBy: { updated_at: "desc" },
  });

  const brandingColor = (tenant?.branding as any)?.primaryColor || "#09090B";

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors"
          >
            ← {backLabel}
          </Link>
          {tenant && (
            <span className="flex items-center gap-2 text-xs font-bold text-zinc-400">
              <span
                className="h-2 w-2 rounded-full border border-black/10"
                style={{ backgroundColor: brandingColor }}
              />
              {tenant.name}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Category Header */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            Category
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            {category.name}
          </h1>
          <p className="text-xs text-zinc-400 font-medium">
            {articles.length} {articles.length === 1 ? "article" : "articles"} in this category
          </p>
        </div>

        {/* Articles List */}
        {articles.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 shadow-xs text-center space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-400 text-lg mb-2">
              📂
            </div>
            <p className="text-sm font-bold text-zinc-950">No published articles yet</p>
            <p className="text-xs text-zinc-400 font-medium">
              Check back soon — articles in this category are being prepared.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all mt-2"
            >
              Browse All Articles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {articles.map((article) => {
              const articleHref = user?.role === "Agent" ? `/agent/articles/${article.id}` : `/articles/${article.id}`;
              return (
                <Link
                  key={article.id}
                  href={articleHref}
                  className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-350 hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3"
                >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border border-zinc-200">
                    {category.name}
                  </span>
                  {article.status !== ArticleStatus.Published && (
                    <span className="rounded bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-750 border border-yellow-200 uppercase">
                      {article.status}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-650 transition-colors leading-snug line-clamp-2">
                  {article.title}
                </h2>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold border-t border-zinc-100 pt-3 mt-auto">
                  <span>{article.author?.name || "System"}</span>
                  <span>{new Date(article.updated_at).toLocaleDateString()}</span>
                </div>
              </Link>
            );})}
          </div>
        )}
      </main>
    </div>
  );
}
