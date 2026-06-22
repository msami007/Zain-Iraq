"use client";

import React, { useState } from "react";

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
}

export default function SuperAdminClient({
  initialTenants,
  initialUsers,
  currentUserId,
}: SuperAdminClientProps) {
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
        // Update user form tenant selection if it was empty
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
        // Append tenant details to user object for table display
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
    <div className="space-y-12">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Total Organizations
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{tenants.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Total Users
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{users.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Audit Coverage
          </div>
          <div className="mt-2 text-3xl font-bold text-purple-400 font-mono">100%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Organization Section */}
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white">Create Organization (Tenant)</h2>
          
          {orgError && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
              {orgError}
            </div>
          )}
          {orgSuccess && (
            <div className="rounded-lg border border-green-500/20 bg-green-950/20 p-3 text-xs text-green-400">
              {orgSuccess}
            </div>
          )}

          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400">Org Name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                placeholder="e.g. OODI Iraq"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">Slug (Auto-generated)</label>
              <input
                type="text"
                required
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                placeholder="e.g. oodi-iraq"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">Branding Primary Color</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={orgColor}
                  onChange={(e) => setOrgColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="text-xs font-mono text-zinc-400">{orgColor}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={orgLoading}
              className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {orgLoading ? "Creating..." : "Create Organization"}
            </button>
          </form>

          {/* Org List */}
          <div className="pt-6 border-t border-zinc-900">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
              Current Organizations
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-900/30 p-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-white">{t.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">/{t.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full border border-black/25"
                      style={{ backgroundColor: t.branding?.primaryColor || "#ccc" }}
                      title="Primary Color"
                    />
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white">Invite / Create User</h2>

          {userError && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
              {userError}
            </div>
          )}
          {userSuccess && (
            <div className="rounded-lg border border-green-500/20 bg-green-950/20 p-3 text-xs text-green-400">
              {userSuccess}
            </div>
          )}

          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">Email Address</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g. john@zain.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400">Password</label>
                <input
                  type="password"
                  required
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">Assigned Org (Tenant)</label>
                <select
                  value={userTenantId}
                  onChange={(e) => setUserTenantId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (/{t.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400">Role Tier</label>
              <div className="mt-2 flex gap-4">
                {["Agent", "Admin", "SuperAdmin"].map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={userRole === role}
                      onChange={() => setUserRole(role)}
                      className="accent-purple-500"
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={userLoading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {userLoading ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-6">User Accounts & Scopes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
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
                  className={`border-b border-zinc-900 hover:bg-zinc-900/10 ${
                    u.id === currentUserId ? "bg-purple-900/5" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-400 font-semibold">
                        You
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-white font-medium">
                      {u.tenant?.name || "Unknown Tenant"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        u.role === "SuperAdmin"
                          ? "bg-purple-500/15 text-purple-400"
                          : u.role === "Admin"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
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
  );
}
