import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CustomerSearchWorkspace from "@/components/CustomerSearchWorkspace";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { q: initialQuery } = await searchParams;
  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Fetch all tenants and categories for public search workspace
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  // Convert Decimals/BigInt or complex fields to plain serializable JSON
  const serializedTenants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    branding: t.branding || {},
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    tenant_id: c.tenant_id,
  }));

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between bg-white text-zinc-900 font-sans overflow-hidden">
      {/* Subtle minimalist grid background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:30px_30px]" />
      
      {/* Header */}
      <header className="w-full border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tight text-zinc-950 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-950" />
            Zain & OODI KB Portal
          </Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard-redirect"
                  className="rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
                >
                  Dashboard ({session.user?.role})
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all shadow-xs"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="z-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 flex-1 flex flex-col items-center justify-center text-center space-y-16">
        
        {/* Intro */}
        <div className="max-w-3xl space-y-4">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-bold text-zinc-650 shadow-2xs uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 animate-pulse" />
            Support Knowledge Base
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl">
            Unified Knowledge Engine
          </h1>
          <p className="max-w-xl mx-auto text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">
            Instant support responses and diagnostic troubleshooting guides for Zain Iraq and OODI mobile operations.
          </p>
        </div>

        {/* Client Workspace */}
        <div className="w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-xs">
          <CustomerSearchWorkspace
            tenants={serializedTenants}
            initialCategories={serializedCategories}
            isLoggedIn={isLoggedIn}
            userRole={session?.user?.role}
            userName={session?.user?.name || undefined}
            initialQuery={initialQuery || ""}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 bg-zinc-50 py-6 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        © {new Date().getFullYear()} Zain Iraq & OODI. All rights reserved.
      </footer>
    </div>
  );
}
