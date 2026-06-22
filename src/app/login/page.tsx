"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
      } else {
        router.push("/dashboard-redirect");
        router.refresh();
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white px-4 py-12 text-zinc-900 font-sans overflow-hidden">
      {/* Premium subtle grid background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:20px_20px]" />
      
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-2xl shadow-zinc-200/60 transition-all duration-300 hover:border-zinc-300">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-md">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950">
            Zain & OODI Portal
          </h2>
          <p className="mt-1.5 text-xs font-medium text-zinc-550">
            Knowledge Base Onboarding Dashboard
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <svg
              className="mt-0.5 h-4.5 w-4.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all"
              placeholder="e.g. Salman@zain.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:opacity-55 transition-all duration-150"
          >
            {loading ? (
              <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-zinc-100 pt-6 text-center">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Quick Demo Logins
          </label>
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            <button
              type="button"
              onClick={() => handleQuickLogin("Salman@zain.com")}
              className="rounded bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 text-[10px] font-bold text-zinc-800 transition-colors border border-zinc-350"
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("agent1.zain@zain.com")}
              className="rounded bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 text-[10px] font-bold text-purple-700 transition-colors border border-purple-200"
            >
              Zain Agent
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("agent.oodi@oodi.com")}
              className="rounded bg-yellow-50 hover:bg-yellow-100 px-2.5 py-1.5 text-[10px] font-bold text-yellow-800 transition-colors border border-yellow-200"
            >
              OODI Agent
            </button>
          </div>
          <p className="text-[9px] font-semibold text-zinc-400">
            Default Password: <span className="font-mono text-zinc-600">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
