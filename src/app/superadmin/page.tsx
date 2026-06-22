import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  // Load all tenants and users
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
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <h2 className="text-2xl font-extrabold text-zinc-950 tracking-tight">Platform Control Center</h2>
          <p className="text-sm font-medium text-zinc-500 mt-1.5">
            Provision organizations, manage tenant-isolated user credentials, and monitor audit scopes.
          </p>
        </div>

        <SuperAdminClient
          initialTenants={serializedTenants}
          initialUsers={serializedUsers}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}
