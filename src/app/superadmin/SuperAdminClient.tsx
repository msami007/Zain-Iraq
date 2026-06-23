"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import AdminDeskWorkspace from "@/components/AdminDeskWorkspace";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  branding?: any;
  created_at: string;
}

interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  tenant?: {
    name: string;
    slug: string;
  };
}

interface SuperAdminClientProps {
  initialTenants: Tenant[];
  initialUsers: User[];
  currentUserId: string;
  currentUserRole: string;
  tenantId: string;
  initialArticles: any[];
  categories: any[];
  activeUsers: any[];
  initialGaps: any[];
  userName?: string;
  userEmail?: string;
  tenantName?: string;
}

export default function SuperAdminClient({
  initialTenants,
  initialUsers,
  currentUserId,
  currentUserRole,
  tenantId,
  initialArticles,
  categories,
  activeUsers,
  initialGaps,
  userName,
  userEmail,
  tenantName,
}: SuperAdminClientProps) {
  const [activeTab, setActiveTab] = useState<"orgs" | "users" | "articles" | "gaps">("orgs");
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Tenant form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgColor, setOrgColor] = useState("#8E24AA");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // User form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("Agent");
  const [userTenantId, setUserTenantId] = useState(initialTenants[0]?.id || "");
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  // Handle Org Slug auto-generation
  const handleNameChange = (name: string) => {
    setOrgName(name);
    setOrgSlug(name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
  };

  // Handle Org Submit
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setOrgSuccess(null);
    setOrgLoading(true);

    try {
      const res = await fetch("/api/v1/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          slug: orgSlug,
          branding: { primaryColor: orgColor },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrgError(data.error || "Failed to create organization");
      } else {
        setOrgSuccess(`Organization "${data.name}" created successfully!`);
        setTenants([data, ...tenants]);
        if (!userTenantId) {
          setUserTenantId(data.id);
        }
        setOrgName("");
        setOrgSlug("");
      }
    } catch (err: any) {
      console.error(err);
      setOrgError("An unexpected error occurred.");
    } finally {
      setOrgLoading(false);
    }
  };

  // Handle User Submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);
    setUserLoading(true);

    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: userPassword,
          role: userRole,
          tenant_id: userTenantId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || "Failed to create user");
      } else {
        setUserSuccess(`User "${data.email}" created successfully!`);
        const selectedTenant = tenants.find((t) => t.id === userTenantId);
        const newUser: User = {
          ...data,
          tenant: selectedTenant
            ? { name: selectedTenant.name, slug: selectedTenant.slug }
            : undefined,
        };
        setUsers([newUser, ...users]);
        setNewUserName("");
        setNewUserEmail("");
        setUserPassword("");
        setUserRole("Agent");
      }
    } catch (err: any) {
      console.error(err);
      setUserError("An unexpected error occurred.");
    } finally {
      setUserLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Disabled" : "Active";
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: data.status } : u));
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: data.role } : u));
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 w-full text-left">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0c0c14] border-r border-white/[0.06] flex flex-col justify-between sticky top-0 h-screen">
        <div>
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-400/[0.09] border border-amber-400/[0.18] flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(251 191 36 / 0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-white uppercase tracking-widest leading-none">Zain & Oodi</div>
                <div className="text-[9px] font-semibold text-white/25 uppercase tracking-widest mt-1">Super Admin</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-3 pt-5 space-y-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-3 mb-2">Platform</p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("orgs")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "orgs" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 0-2 2h-2"/>
                    <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
                  </svg>
                  Organizations
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("users")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "users" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  User Accounts
                </button>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-3 mb-2">Content</p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("articles")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "articles" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  Articles Manager
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("gaps")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "gaps" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  Gaps Queue
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* User Footer */}
        <div className="px-3 pt-4 pb-4 border-t border-white/[0.06] space-y-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-indigo-300">{userName?.[0]?.toUpperCase() ?? "S"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-white truncate leading-none mb-0.5">{userName}</div>
              <div className="text-[10px] font-mono text-white/35 truncate">{userEmail}</div>
            </div>
          </div>
          <div className="px-1">
            <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-amber-400/[0.08] border border-amber-400/[0.15] text-amber-400/70">
              <span className="h-1 w-1 rounded-full bg-amber-400/70" />
              {currentUserRole}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.13] px-3 py-2 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Content panel - right */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50">
        <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
          <div>
            <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide text-left">
              {activeTab === "orgs" && "Organizations Control"}
              {activeTab === "users" && "User Accounts & Permissions"}
              {activeTab === "articles" && "Articles Manager"}
              {activeTab === "gaps" && "Knowledge Gaps"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-650">
              Scope: Platform Super Admin
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "orgs" && (
            <div className="space-y-8">
              {/* Org Stats Card */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Registered Organizations</div>
                  <div className="mt-2 text-3xl font-extrabold text-zinc-955">{tenants.length}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Branding Primary Theme</div>
                  <div className="mt-2 text-sm font-bold text-zinc-800 flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-zinc-950 border border-zinc-200" />
                    White Primary / Dark Accent
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Organization Creation Card */}
                <div className="lg:col-span-1 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    Add Organization
                  </h2>
                  
                  {orgError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-750">
                      {orgError}
                    </div>
                  )}
                  {orgSuccess && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs font-semibold text-green-750">
                      {orgSuccess}
                    </div>
                  )}

                  <form onSubmit={handleOrgSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Org Name</label>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="e.g. OODI Iraq"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Slug (Auto-generated)</label>
                      <input
                        type="text"
                        required
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="e.g. oodi-iraq"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Branding Primary Color</label>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="color"
                          value={orgColor}
                          onChange={(e) => setOrgColor(e.target.value)}
                          className="h-8 w-12 cursor-pointer rounded border border-zinc-250 bg-transparent"
                        />
                        <span className="text-xs font-mono text-zinc-500">{orgColor}</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={orgLoading}
                      className="w-full rounded-lg bg-zinc-950 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-55 transition-colors"
                    >
                      {orgLoading ? "Creating..." : "Create Organization"}
                    </button>
                  </form>
                </div>

                {/* Org List */}
                <div className="lg:col-span-2 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h3 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    Current Organizations
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-750">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Slug</th>
                          <th className="py-3 px-4">Branding</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((t) => (
                          <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-zinc-955">{t.name}</td>
                            <td className="py-3.5 px-4 font-mono text-xs text-zinc-500">/{t.slug}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-xs"
                                  style={{ backgroundColor: t.branding?.primaryColor || "#ccc" }}
                                />
                                <span className="text-xs font-mono text-zinc-500">{t.branding?.primaryColor || "#ccc"}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200 uppercase">
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-8">
              {/* User Stats Card */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Registered User Accounts</div>
                  <div className="mt-2 text-3xl font-extrabold text-zinc-955">{users.length}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Access Controls</div>
                  <div className="mt-2 text-sm font-bold text-zinc-800 flex items-center gap-2">
                    🛡️ Multi-Tenant Role Isolation Enforced
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* User Account Creation Card */}
                <div className="lg:col-span-1 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    Create User Account
                  </h2>

                  {userError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-750">
                      {userError}
                    </div>
                  )}
                  {userSuccess && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs font-semibold text-green-750">
                      {userSuccess}
                    </div>
                  )}

                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="e.g. john@zain.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Password</label>
                      <input
                        type="password"
                        required
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Assigned Org</label>
                      <select
                        value={userTenantId}
                        onChange={(e) => setUserTenantId(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                      >
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (/{t.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Role Scope</label>
                      <div className="mt-2.5 flex gap-4">
                        {["Agent", "Admin", "SuperAdmin"].map((role) => (
                          <label key={role} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-zinc-700">
                            <input
                              type="radio"
                              name="role"
                              value={role}
                              checked={userRole === role}
                              onChange={() => setUserRole(role)}
                              className="accent-zinc-955"
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={userLoading}
                      className="w-full rounded-lg bg-zinc-950 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-55 transition-colors"
                    >
                      {userLoading ? "Creating..." : "Create User"}
                    </button>
                  </form>
                </div>

                {/* Users Scope Table */}
                <div className="lg:col-span-2 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    User Accounts & Permissions
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-750">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Organization</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            className={`border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors ${
                              u.id === currentUserId ? "bg-zinc-50/70" : ""
                            }`}
                          >
                            <td className="py-3.5 px-4 font-bold text-zinc-900 flex items-center gap-2">
                              {u.name}
                              {u.id === currentUserId && (
                                <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-zinc-500">{u.email}</td>
                            <td className="py-3.5 px-4">
                              <span className="text-zinc-900 font-semibold">
                                {u.tenant?.name || "Unknown Tenant"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {u.id === currentUserId ? (
                                <span className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-zinc-950 text-white border-zinc-950">
                                  {u.role}
                                </span>
                              ) : (
                                <select
                                  value={u.role}
                                  disabled={updatingUserId === u.id}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  className="rounded border border-zinc-200 bg-white text-[11px] font-semibold text-zinc-700 px-2 py-1 focus:outline-none focus:border-zinc-400 disabled:opacity-50 cursor-pointer hover:border-zinc-300 transition-colors"
                                >
                                  <option value="Agent">Agent</option>
                                  <option value="Admin">Admin</option>
                                  <option value="SuperAdmin">SuperAdmin</option>
                                </select>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {u.id === currentUserId ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                  {u.status}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updatingUserId === u.id}
                                  onClick={() => handleToggleStatus(u.id, u.status)}
                                  className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all disabled:opacity-50 rounded px-2 py-0.5 border ${
                                    u.status === "Active"
                                      ? "text-green-700 border-green-200 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                      : u.status === "Disabled"
                                      ? "text-red-600 border-red-200 bg-red-50 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                                      : "text-zinc-500 border-zinc-200 bg-zinc-50"
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                                    u.status === "Active" ? "bg-green-500" :
                                    u.status === "Disabled" ? "bg-red-500" : "bg-zinc-400"
                                  }`} />
                                  {updatingUserId === u.id ? "..." : u.status}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "articles" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={initialArticles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={initialGaps}
                hideSidebar={true}
                overrideActiveTab="articles"
              />
            </div>
          )}

          {activeTab === "gaps" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={initialArticles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={initialGaps}
                hideSidebar={true}
                overrideActiveTab="gaps"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

