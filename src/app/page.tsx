import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 font-sans overflow-hidden">
      {/* Background gradients representing Zain purple and OODI yellow */}
      <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-purple-900/10 blur-[150px]" />
      <div className="absolute bottom-0 left-0 -z-10 h-[600px] w-[600px] rounded-full bg-yellow-500/5 blur-[150px]" />

      <main className="z-10 flex w-full max-w-4xl flex-col items-center text-center">
        {/* Logo / Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-xs font-medium text-purple-400">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          Day 1 Gate Verification
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent pb-2">
          Zain & OODI Knowledge Engine
        </h1>
        
        <p className="mt-6 max-w-xl text-lg text-zinc-400 leading-relaxed">
          The unified knowledge management platform for Zain Iraq and OODI customer support operations. Securely isolated, role-enforced, and performance-optimized.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
          {isLoggedIn ? (
            <div className="w-full flex flex-col gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm text-sm text-zinc-300">
                Logged in as <strong className="text-white">{session.user?.name}</strong> 
                <span className="mx-2 text-zinc-600">|</span> 
                Role: <span className="rounded bg-purple-500/10 px-2 py-0.5 text-purple-400 font-mono text-xs">{session.user?.role}</span>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/dashboard-redirect"
                  className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all text-center"
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
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-zinc-300 hover:text-white transition-all"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all text-center"
            >
              Sign In to Portal
            </Link>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left w-full">
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 backdrop-blur-sm">
            <div className="mb-3 text-purple-400 font-semibold text-sm">01 / Tenant Isolation</div>
            <h3 className="text-base font-medium text-white">Strict Scoping</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Every database query and mutation is automatically partitioned at the query engine level using scoped tenant identifiers.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 backdrop-blur-sm">
            <div className="mb-3 text-purple-400 font-semibold text-sm">02 / Dynamic RBAC</div>
            <h3 className="text-base font-medium text-white">Enforced Roles</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Four tier role-based permission system enforced by server-side middleware and NextAuth secure session tokens.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 backdrop-blur-sm">
            <div className="mb-3 text-purple-400 font-semibold text-sm">03 / Onboarding Demo</div>
            <h3 className="text-base font-medium text-white">Render Deployable</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Designed as a single unified deployable service running Next.js App Router, Prisma ORM, and PostgreSQL.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
