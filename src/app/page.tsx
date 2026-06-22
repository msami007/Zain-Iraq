import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-4 text-zinc-900 font-sans overflow-hidden">
      {/* Subtle minimalist grid background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:30px_30px]" />
      
      <main className="z-10 flex w-full max-w-4xl flex-col items-center text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-zinc-650 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 animate-pulse" />
          Day 1 Gate Validation Active
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl pb-2">
          Zain & OODI Knowledge Engine
        </h1>
        
        <p className="mt-5 max-w-xl text-base text-zinc-500 leading-relaxed font-medium">
          Unified knowledge management portal for Zain Iraq and OODI customer support operations. Securely partitioned, role-enforced, and performance-optimized.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
          {isLoggedIn ? (
            <div className="w-full flex flex-col gap-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 shadow-sm text-sm text-zinc-700">
                Logged in as <strong className="text-zinc-950">{session.user?.name}</strong> 
                <span className="mx-2 text-zinc-300">|</span> 
                Role: <span className="rounded bg-zinc-900 px-2 py-0.5 text-white font-mono text-xs">{session.user?.role}</span>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/dashboard-redirect"
                  className="flex-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all text-center"
                >
                  Go to Dashboard
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                  className="flex-1"
                >
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:text-zinc-900 transition-all shadow-sm"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full rounded-lg bg-zinc-950 hover:bg-zinc-800 px-8 py-4 text-base font-semibold text-white shadow-md transition-all text-center"
            >
              Sign In to Portal
            </Link>
          )}
        </div>

        {/* Feature Grid with thin outlines */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left w-full">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all duration-200">
            <div className="mb-3 text-zinc-400 font-bold text-xs uppercase tracking-wider">01 / Scoped Isolation</div>
            <h3 className="text-base font-bold text-zinc-950">Multi-Tenancy</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-medium">
              Every database query and mutation is partitioned dynamically at the Prisma query engine level.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all duration-200">
            <div className="mb-3 text-zinc-400 font-bold text-xs uppercase tracking-wider">02 / Enforced RBAC</div>
            <h3 className="text-base font-bold text-zinc-950">Secure Guards</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-medium">
              Four-tier role-based access controls enforced by server-side Next.js route proxies and NextAuth sessions.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all duration-200">
            <div className="mb-3 text-zinc-400 font-bold text-xs uppercase tracking-wider">03 / Platform Seeding</div>
            <h3 className="text-base font-bold text-zinc-950">Seeded State</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-medium">
              Pre-provisioned with sample categories and articles for Zain Iraq and OODI to verify isolation borders.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
