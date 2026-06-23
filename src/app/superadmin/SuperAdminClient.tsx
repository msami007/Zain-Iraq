"use client";

import React, { useState } from "react";
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
}: SuperAdminClientProps) {
  const [activeMainTab, setActiveMainTab] = useState<"platform" | "content">("platform");
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [users, setUsers] = useState<User[]>(initialUsers);

  // Tenant form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgColor, setOrgColor] = useState("#8E24AA");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // User form state
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
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
          name: userName,
          email: userEmail,
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
        setUserName("");
        setUserEmail("");
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

  return (
    <div className="space-y-6">
      {/* Main Tab Selection */}
      <div className="flex border-b border-zinc-200 gap-1 mb-6">
        <button
          type="button"
          onClick={() => setActiveMainTab("platform")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeMainTab === "platform"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          Platform Control Center
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("content")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeMainTab === "content"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          Content & Articles Manager
        </button>
      </div>

      {activeMainTab === "content" ? (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="border-b border-zinc-100 pb-4 mb-6 text-left">
            <h2 className="text-lg font-extrabold text-zinc-950">Tenant Content Workspace</h2>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Scope: Organization Content lifecycle, workflow approvals, variants editing, and gaps resolution.
            </p>
          </div>
          <AdminDeskWorkspace
            initialArticles={initialArticles}
            categories={categories}
            users={activeUsers}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            tenantId={tenantId}
            initialGaps={initialGaps}
          />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Overview Stats Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Total Organizations
              </div>
              <div className="mt-2 text-3xl font-extrabold text-zinc-950">{tenants.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Total Users
              </div>
              <div className="mt-2 text-3xl font-extrabold text-zinc-950">{users.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Audit Enforced
              </div>
              <div className="mt-2 text-3xl font-extrabold text-zinc-950 font-mono">100%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Organization Creation Card */}
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-zinc-950 uppercase tracking-wide border-b border-zinc-100 pb-3">
                Add Organization (Tenant)
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
                    className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-955 transition-all"
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
                    className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-955 transition-all"
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
                      className="h-8 w-12 cursor-pointer rounded border border-zinc-200 bg-transparent"
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

              {/* Org List */}
              <div className="pt-6 border-t border-zinc-100 text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                  Current Organizations
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {tenants.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow-xs hover:border-zinc-300 transition-all"
                    >
                      <div>
                        <div className="font-bold text-sm text-zinc-955">{t.name}</div>
                        <div className="text-xs text-zinc-400 font-mono">/{t.slug}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full border border-black/10 shadow-xs"
                          style={{ backgroundColor: t.branding?.primaryColor || "#ccc" }}
                        />
                        <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200 uppercase">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* User Account Invite Card */}
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-zinc-950 uppercase tracking-wide border-b border-zinc-100 pb-3">
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
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      placeholder="e.g. john@zain.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Password</label>
                    <input
                      type="password"
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Assigned Org</label>
                    <select
                      value={userTenantId}
                      onChange={(e) => setUserTenantId(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-955 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (/{t.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Role Scope</label>
                  <div className="mt-2.5 flex gap-5">
                    {["Agent", "Admin", "SuperAdmin"].map((role) => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-zinc-700">
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
          </div>

          {/* Users Scope Table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm text-left">
            <h2 className="text-base font-extrabold text-zinc-950 uppercase tracking-wide border-b border-zinc-100 pb-4 mb-4">
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
                      className={`border-b border-zinc-100 hover:bg-zinc-50/40 transition-colors ${
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
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            u.role === "SuperAdmin"
                              ? "bg-zinc-950 text-white border-zinc-950"
                              : u.role === "Admin"
                              ? "bg-zinc-50 text-zinc-900 border-zinc-300"
                              : "bg-white text-zinc-500 border-zinc-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
