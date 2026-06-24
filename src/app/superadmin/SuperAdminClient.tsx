"use client";

import React, { useState, useEffect } from "react";
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
  user_teams?: {
    team: { id: string; name: string }
  }[];
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
  signOutAction?: () => Promise<void>;
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
  signOutAction,
}: SuperAdminClientProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "orgs" | "users" | "teams" | "articles" | "gaps" | "workflows" | "audit" | "glossary">("dashboard");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryCategory, setGlossaryCategory] = useState("All");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsWindow, setAnalyticsWindow] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [categorySortAsc, setCategorySortAsc] = useState(false);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/v1/analytics?tenant_id=${tenantId}&_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchAnalytics();
    }
  }, [activeTab]);
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Lifted state for articles and gaps to sync between tabs in SuperAdmin view
  const [articles, setArticles] = useState<any[]>(initialArticles);
  const [gaps, setGaps] = useState<any[]>(initialGaps);
  const [seededGapForRedirect, setSeededGapForRedirect] = useState<{ id: string; query_text: string } | null>(null);

  const handleUpdateGapsState = (updatedGaps: any[]) => {
    setGaps(updatedGaps);
  };

  const handleUpdateArticles = (updatedArticles: any[]) => {
    setArticles(updatedArticles);
  };

  const handleRedirectToTab = (
    tab: "articles" | "gaps" | "workflows" | "audit",
    seededGap?: { id: string; query_text: string }
  ) => {
    if (seededGap) {
      setSeededGapForRedirect(seededGap);
    } else {
      setSeededGapForRedirect(null);
    }
    setActiveTab(tab);
  };

  // Teams state
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamTenantId, setTeamTenantId] = useState(initialTenants[0]?.id || "");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  // User creation teams state
  const [userSelectedTeams, setUserSelectedTeams] = useState<string[]>([]);
  const [isTeamsDropdownOpen, setIsTeamsDropdownOpen] = useState(false);

  // User team editing modal state
  const [editingUserTeams, setEditingUserTeams] = useState<User | null>(null);
  const [modalSelectedTeams, setModalSelectedTeams] = useState<string[]>([]);
  const [isModalTeamsDropdownOpen, setIsModalTeamsDropdownOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

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

  // Fetch teams from api
  const fetchTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch("/api/v1/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [activeTab]);

  // Handle Team Submit
  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setTeamSuccess(null);
    setTeamLoading(true);

    try {
      const res = await fetch("/api/v1/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          tenant_id: teamTenantId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTeamError(data.error || "Failed to create team");
      } else {
        setTeamSuccess(`Team "${data.name}" created successfully!`);
        setNewTeamName("");
        fetchTeams();
      }
    } catch (err: any) {
      console.error(err);
      setTeamError("An unexpected error occurred.");
    } finally {
      setTeamLoading(false);
    }
  };

  // Handle Delete Team
  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
      const res = await fetch(`/api/v1/teams?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTeams(prev => prev.filter(t => t.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete team");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open modal inline team editor
  const openTeamEditorModal = (user: User) => {
    setEditingUserTeams(user);
    setModalSelectedTeams(user.user_teams?.map(ut => ut.team.id) || []);
  };

  // Save user teams inside modal
  const handleSaveUserTeams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserTeams) return;
    setModalSaving(true);
    try {
      const res = await fetch(`/api/v1/users/${editingUserTeams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_ids: modalSelectedTeams,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === editingUserTeams.id ? {
          ...u,
          user_teams: data.user_teams,
        } : u));
        setEditingUserTeams(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save teams");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModalSaving(false);
    }
  };

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
          team_ids: userSelectedTeams,
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
        setUserSelectedTeams([]);
        setIsTeamsDropdownOpen(false);
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
    <div className="min-h-screen flex bg-zinc-50 w-full text-left relative">
      {/* Sidebar Backdrop for Mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-56 flex-shrink-0 bg-[#0c0c14] border-r border-white/[0.06] flex flex-col justify-between fixed inset-y-0 left-0 z-50 transform md:sticky md:translate-x-0 transition-transform duration-200 ease-in-out h-screen ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
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
                  onClick={() => { setActiveTab("dashboard"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "dashboard" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <rect x="3" y="3" width="7" height="9" rx="1"/>
                    <rect x="14" y="3" width="7" height="5" rx="1"/>
                    <rect x="14" y="12" width="7" height="9" rx="1"/>
                    <rect x="3" y="16" width="7" height="5" rx="1"/>
                  </svg>
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("orgs"); setMobileSidebarOpen(false); }}
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
                  onClick={() => { setActiveTab("users"); setMobileSidebarOpen(false); }}
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
                <button
                  type="button"
                  onClick={() => { setActiveTab("teams"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "teams" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Teams Manager
                </button>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-3 mb-2">Content</p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => { setActiveTab("articles"); setMobileSidebarOpen(false); }}
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
                  onClick={() => { setActiveTab("gaps"); setMobileSidebarOpen(false); }}
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
                 <button
                  type="button"
                  onClick={() => { setActiveTab("workflows"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "workflows" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Workflows
                  {articles.filter((a: any) => a.status === "InReview" || a.status === "Approved").length > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/20">
                      {articles.filter((a: any) => a.status === "InReview" || a.status === "Approved").length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("audit"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "audit" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  Audit Logs
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("glossary"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-left ${
                    activeTab === "glossary" ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                  </svg>
                  Glossary
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
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = "/login";
            }}
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
        <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-4 md:px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide text-left">
                {activeTab === "dashboard" && "Analytics Dashboard"}
                {activeTab === "orgs" && "Organizations Control"}
                {activeTab === "users" && "User Accounts & Permissions"}
                {activeTab === "teams" && "Teams Manager"}
                {activeTab === "articles" && "Articles Manager"}
                {activeTab === "gaps" && "Knowledge Gaps"}
                {activeTab === "workflows" && "Workflows Queue"}
                {activeTab === "audit" && "Audit Logs View"}
                {activeTab === "glossary" && "Glossary"}
              </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-650">
              Scope: Platform Super Admin
            </span>
            {activeTab === "dashboard" && (
              <button
                type="button"
                onClick={fetchAnalytics}
                disabled={loadingAnalytics}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-xs transition-all disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loadingAnalytics ? "animate-spin" : ""}>
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {loadingAnalytics ? "Refreshing…" : "Refresh"}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "dashboard" && (
            <div className="space-y-6">

              {loadingAnalytics && !analyticsData ? (
                <div className="text-center py-16 text-zinc-450 font-semibold animate-pulse">Loading platform metrics...</div>
              ) : !analyticsData ? (
                <div className="text-center py-16 text-zinc-400 italic">No analytics data available.</div>
              ) : (
                <div className="space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Total Views */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#7c3aed,#a78bfa)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Views</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.totalViews.toLocaleString()}</div>
                      <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-zinc-400">All time</div>
                    </div>
                    {/* Helpful Rate */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#0891b2,#22d3ee)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Helpful Rate</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.helpfulRate}%</div>
                      {analyticsData.helpfulRateDelta != null ? (
                        <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${analyticsData.helpfulRateDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {analyticsData.helpfulRateDelta >= 0 ? <span>▲</span> : <span>▼</span>}
                          {analyticsData.helpfulRateDelta > 0 ? "+" : ""}{analyticsData.helpfulRateDelta}pp this month
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-zinc-400">Based on feedback</div>
                      )}
                    </div>
                    {/* Knowledge Gaps */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#dc2626,#f87171)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Knowledge Gaps</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.totalGaps.toLocaleString()}</div>
                      {analyticsData.gapsThisWeek != null && (
                        <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-red-500">
                          <span>▼</span>{analyticsData.gapsThisWeek} new this week
                        </div>
                      )}
                    </div>
                    {/* Total Searches */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#059669,#34d399)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Searches</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.totalSearches.toLocaleString()}</div>
                      {analyticsData.searchVsYesterday != null ? (
                        <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${analyticsData.searchVsYesterday >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {analyticsData.searchVsYesterday >= 0 ? <span>▲</span> : <span>▼</span>}
                          {analyticsData.searchVsYesterday > 0 ? "+" : ""}{analyticsData.searchVsYesterday}% vs yesterday
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-zinc-400">vs yesterday</div>
                      )}
                    </div>
                    {/* Avg. Confidence */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#d97706,#fbbf24)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Avg. Confidence</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.avgConfidence}%</div>
                      <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-zinc-400">Match quality</div>
                    </div>
                    {/* Total Articles */}
                    <div className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,#2563eb,#60a5fa)" }} />
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Articles</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{analyticsData.totalArticles.toLocaleString()}</div>
                      {analyticsData.articlesThisWeek != null && (
                        <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-green-600">
                          <span>▲</span>+{analyticsData.articlesThisWeek} this week
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Three-Row × Two-Column Grid — each row pairs cards so CSS grid auto-equalises heights */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-left">

                    {/* ROW 1 — LEFT: Views by Category */}
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-md flex flex-col">
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Views by Category</h3>
                        <button
                          type="button"
                          onClick={() => setCategorySortAsc(v => !v)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 transition-colors"
                          title={categorySortAsc ? "Sorted: Least → Most" : "Sorted: Most → Least"}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${categorySortAsc ? "rotate-180" : ""}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          {categorySortAsc ? "Least → Most" : "Most → Least"}
                        </button>
                      </div>
                      {analyticsData.viewsByCategory && analyticsData.viewsByCategory.length > 0 ? (
                        <div className="max-h-[240px] overflow-y-auto pr-1 space-y-3.5 no-scrollbar">
                          {[...analyticsData.viewsByCategory]
                            .sort((a: any, b: any) => categorySortAsc ? a.count - b.count : b.count - a.count)
                            .map((c: any) => {
                              const maxCount = Math.max(...analyticsData.viewsByCategory.map((x: any) => x.count), 1);
                              const percentage = (c.count / maxCount) * 100;
                              return (
                                <div key={c.name} className="space-y-1.5">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-zinc-700">{c.name}</span>
                                    <span className="text-zinc-900 font-bold">{c.count} views</span>
                                  </div>
                                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-400 italic font-semibold text-sm">No views data</div>
                      )}
                    </div>

                    {/* ROW 1 — RIGHT: Content Breakdown */}
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-md flex flex-col">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455 mb-4 flex-shrink-0">Content Breakdown</h3>
                      {analyticsData.contentBreakdown && analyticsData.contentBreakdown.length > 0 ? (
                        <div className="flex-1 space-y-3.5">
                          {analyticsData.contentBreakdown.map((cb: any) => {
                            const total = analyticsData.totalArticles || 1;
                            const percentage = (cb.count / total) * 100;
                            return (
                              <div key={cb.status} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="text-zinc-700">{cb.status}</span>
                                  <span className="text-zinc-900 font-bold">{cb.count} articles ({Math.round(percentage)}%)</span>
                                </div>
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
                                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-400 italic font-semibold text-sm">No content statistics.</div>
                      )}
                    </div>

                    {/* ROW 2 — LEFT: Top Articles by Views */}
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-md flex flex-col overflow-hidden">
                      <div className="px-6 pt-5 pb-3 flex-shrink-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Top Articles by Views</h3>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        {analyticsData.topArticles && analyticsData.topArticles.length > 0 ? (
                          <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10px] font-bold">
                                <th className="py-2.5 px-4">#</th>
                                <th className="py-2.5 px-4">Article</th>
                                <th className="py-2.5 px-4">Views</th>
                                <th className="py-2.5 px-4 text-right">Helpful</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {analyticsData.topArticles.map((a: any, i: number) => (
                                <tr key={a.id} className="hover:bg-zinc-50/50">
                                  <td className="py-3 px-4 font-mono font-bold text-zinc-400">{i + 1}</td>
                                  <td className="py-3 px-4 font-bold text-zinc-955 truncate max-w-[200px]" title={a.title}>{a.title}</td>
                                  <td className="py-3 px-4 font-semibold text-zinc-650">{a.views}</td>
                                  <td className="py-3 px-4 text-right font-bold text-green-700">{a.helpfulPct}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex items-center justify-center py-10 text-zinc-400 italic font-semibold">No articles views logged.</div>
                        )}
                      </div>
                    </div>

                    {/* ROW 2 — RIGHT: Recent Searches */}
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-md flex flex-col overflow-hidden">
                      <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Recent Searches</h3>
                        <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-full text-[9px] font-extrabold bg-red-100 text-red-700">
                          {analyticsData.totalGaps} gaps
                        </span>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        {analyticsData.recentSearches && analyticsData.recentSearches.length > 0 ? (
                          <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10px] font-bold">
                                <th className="py-2.5 px-4">Query</th>
                                <th className="py-2.5 px-4">Confidence</th>
                                <th className="py-2.5 px-4 text-right">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {analyticsData.recentSearches.map((s: any, idx: number) => (
                                <tr key={idx} className="hover:bg-zinc-50/50">
                                  <td className="py-3 px-4 font-bold text-zinc-955 italic truncate max-w-[140px]" title={s.query}>"{s.query}"</td>
                                  <td className="py-3 px-4 font-semibold text-zinc-650">{s.confidence}%</td>
                                  <td className="py-3 px-4 text-right text-zinc-400 font-mono">{new Date(s.date).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex items-center justify-center py-10 text-zinc-400 italic font-semibold">No recent searches.</div>
                        )}
                      </div>
                      <div className="px-6 pb-5 pt-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveTab("gaps")}
                          className="w-full bg-zinc-950 hover:bg-zinc-850 py-2.5 rounded-lg text-xs font-bold text-white transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          View All Gaps
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ROW 3 — LEFT: Top Search Queries */}
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-md flex flex-col overflow-hidden">
                      <div className="px-6 pt-5 pb-3 flex-shrink-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Top Search Queries</h3>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        {analyticsData.topSearchQueries && analyticsData.topSearchQueries.length > 0 ? (
                          <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10px] font-bold">
                                <th className="py-2.5 px-4">Query</th>
                                <th className="py-2.5 px-4 text-right">Count</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {analyticsData.topSearchQueries.map((q: any) => (
                                <tr key={q.query} className="hover:bg-zinc-50/50">
                                  <td className="py-3 px-4 font-bold text-zinc-955 italic">"{q.query}"</td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-zinc-600">{q.count}x</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex items-center justify-center py-10 text-zinc-400 italic font-semibold">No search queries logged.</div>
                        )}
                      </div>
                    </div>

                    {/* ROW 3 — RIGHT: Articles Needing Attention */}
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-md flex flex-col overflow-hidden">
                      <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Articles Needing Attention</h3>
                        <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          Low helpful rate
                        </span>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        {analyticsData.articlesNeedingAttention && analyticsData.articlesNeedingAttention.length > 0 ? (
                          <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10px] font-bold">
                                <th className="py-3 px-4">Article</th>
                                <th className="py-3 px-4">Views</th>
                                <th className="py-3 px-4">Helpful</th>
                                <th className="py-3 px-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {analyticsData.articlesNeedingAttention.map((a: any) => (
                                <tr key={a.id} className="hover:bg-zinc-50/50">
                                  <td className="py-3 px-4 font-bold text-zinc-955 truncate max-w-[140px]" title={a.title}>{a.title}</td>
                                  <td className="py-3 px-4 text-zinc-600 font-semibold">{a.views}</td>
                                  <td className="py-3 px-4 text-red-650 font-bold">{a.helpfulPct}%</td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab("articles")}
                                      className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[9px] font-bold text-zinc-650 transition-colors shadow-2xs"
                                    >
                                      Review
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex items-center justify-center py-10 text-zinc-400 italic font-semibold">No articles needing attention.</div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

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
                    {teams.filter(t => t.tenant_id === userTenantId).length > 0 && (
                      <div className="relative">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Assign to Teams</label>
                        <button
                          type="button"
                          onClick={() => setIsTeamsDropdownOpen(!isTeamsDropdownOpen)}
                          className="flex items-center justify-between w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 hover:bg-zinc-100 transition-colors text-left"
                        >
                          <span className="truncate">
                            {userSelectedTeams.length === 0
                              ? "Select Teams..."
                              : teams
                                  .filter(t => userSelectedTeams.includes(t.id))
                                  .map(t => t.name)
                                  .join(", ")}
                          </span>
                          <svg className="h-4 w-4 text-zinc-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isTeamsDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsTeamsDropdownOpen(false)} />
                            <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 text-left shadow-md max-h-40 overflow-y-auto space-y-1">
                              {teams.filter(t => t.tenant_id === userTenantId).map((team) => (
                                <label key={team.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-700 hover:bg-zinc-50 p-2 rounded transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={userSelectedTeams.includes(team.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setUserSelectedTeams([...userSelectedTeams, team.id]);
                                      } else {
                                        setUserSelectedTeams(userSelectedTeams.filter(id => id !== team.id));
                                      }
                                    }}
                                    className="accent-zinc-955"
                                  />
                                  <span className="truncate">{team.name}</span>
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
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
                          <th className="py-3 px-4">Teams</th>
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
                              <div className="flex flex-wrap gap-1 items-center">
                                {u.user_teams && u.user_teams.length > 0 ? (
                                  u.user_teams.map((ut: any) => (
                                    <span key={ut.team.id} className="rounded bg-zinc-150 border border-zinc-250 px-1.5 py-0.5 text-[9px] font-bold text-zinc-750">
                                      {ut.team.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-zinc-400 font-semibold italic">No Teams</span>
                                )}
                                {u.id !== currentUserId && (
                                  <button
                                    type="button"
                                    onClick={() => openTeamEditorModal(u)}
                                    className="ml-2 text-zinc-550 hover:text-zinc-950 text-[10px] font-bold underline transition-colors"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
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

          {activeTab === "teams" && (
            <div className="space-y-8">
              {/* Stats card */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Teams Created</div>
                  <div className="mt-2 text-3xl font-extrabold text-zinc-955">{teams.length}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Lines of Business Isolation</div>
                  <div className="mt-2 text-sm font-bold text-zinc-800 flex items-center gap-2">
                    🔒 Team-based article visibility active
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Team Creation Form */}
                <div className="lg:col-span-1 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    Add Team
                  </h2>
                  
                  {teamError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-750">
                      {teamError}
                    </div>
                  )}
                  {teamSuccess && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs font-semibold text-green-750">
                      {teamSuccess}
                    </div>
                  )}

                  <form onSubmit={handleTeamSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Team Name</label>
                      <input
                        type="text"
                        required
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                        placeholder="e.g. Zain Care Team"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Assigned Organization</label>
                      <select
                        value={teamTenantId}
                        onChange={(e) => setTeamTenantId(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                      >
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (/{t.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={teamLoading}
                      className="w-full rounded-lg bg-zinc-950 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-55 transition-colors"
                    >
                      {teamLoading ? "Creating..." : "Create Team"}
                    </button>
                  </form>
                </div>

                {/* Team List Table */}
                <div className="lg:col-span-2 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-left">
                  <h3 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide border-b border-zinc-100 pb-3">
                    Active Teams
                  </h3>
                  <div className="overflow-x-auto">
                    {loadingTeams ? (
                      <div className="text-center text-xs text-zinc-500 py-8 font-semibold animate-pulse">Loading teams...</div>
                    ) : teams.length === 0 ? (
                      <div className="text-center text-xs text-zinc-400 py-8 font-semibold italic">No teams configured yet.</div>
                    ) : (
                      <table className="w-full text-left text-sm text-zinc-750">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Organization</th>
                            <th className="py-3 px-4">Members</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teams.map((t) => {
                            const teamTenantName = tenants.find(ten => ten.id === t.tenant_id)?.name || "Unknown Tenant";
                            return (
                              <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                <td className="py-3.5 px-4 font-bold text-zinc-955">{t.name}</td>
                                <td className="py-3.5 px-4 font-semibold text-zinc-600">{teamTenantName}</td>
                                <td className="py-3.5 px-4">
                                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                                    {t.user_teams && t.user_teams.length > 0 ? (
                                      t.user_teams.map((ut: any) => (
                                        <span key={ut.user_id} className="rounded bg-zinc-100 border border-zinc-250 px-1.5 py-0.5 text-[9px] font-bold text-zinc-750" title={ut.user.email}>
                                          {ut.user.name} ({ut.user.role})
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-zinc-400 font-semibold italic">No Members</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTeam(t.id)}
                                    className="rounded border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-600 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "articles" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={articles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={gaps}
                hideSidebar={true}
                overrideActiveTab="articles"
                onUpdateArticles={handleUpdateArticles}
                onUpdateGapsState={handleUpdateGapsState}
                seededGap={seededGapForRedirect}
                onRedirectToTab={handleRedirectToTab}
              />
            </div>
          )}

          {activeTab === "gaps" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={articles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={gaps}
                hideSidebar={true}
                overrideActiveTab="gaps"
                onUpdateArticles={handleUpdateArticles}
                onUpdateGapsState={handleUpdateGapsState}
                seededGap={seededGapForRedirect}
                onRedirectToTab={handleRedirectToTab}
              />
            </div>
          )}

          {activeTab === "workflows" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={articles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={gaps}
                hideSidebar={true}
                overrideActiveTab="workflows"
                onUpdateArticles={handleUpdateArticles}
                onUpdateGapsState={handleUpdateGapsState}
                seededGap={seededGapForRedirect}
                onRedirectToTab={handleRedirectToTab}
              />
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-6">
              <AdminDeskWorkspace
                initialArticles={articles}
                categories={categories}
                users={activeUsers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                tenantId={tenantId}
                initialGaps={gaps}
                hideSidebar={true}
                overrideActiveTab="audit"
                onUpdateArticles={handleUpdateArticles}
                onUpdateGapsState={handleUpdateGapsState}
                seededGap={seededGapForRedirect}
                onRedirectToTab={handleRedirectToTab}
              />
            </div>
          )}

          {/* GLOSSARY TAB */}
          {activeTab === "glossary" && (() => {
            const sections = [
              {
                category: "Platform & Tenants",
                badgeClass: "bg-violet-50 border-violet-100 text-violet-700",
                barClass: "bg-violet-500",
                borderClass: "border-l-violet-300",
                items: [
                  { term: "Tenant / Organization", def: "A separate company using the platform (e.g. Zain Iraq, OODI). Each tenant has its own isolated KB, articles, users, and analytics — fully separated from other tenants." },
                  { term: "Tenant ID", def: "A unique identifier assigned to each organization. Used internally to scope all database queries and prevent data leakage between tenants." },
                  { term: "Blueprint Managed", def: "The Render deployment is managed via a render.yaml file — infrastructure changes should go through that file, not the Render dashboard manually." },
                  { term: "Slug", def: "A URL-friendly version of a name (e.g. 'zain-iraq'). Used to identify tenants and articles in links." },
                  { term: "NEXTAUTH_URL", def: "An environment variable set in Render that tells NextAuth the public-facing URL of the app. Must be set correctly to avoid auth redirects pointing to internal addresses." },
                ],
              },
              {
                category: "Analytics & Metrics",
                badgeClass: "bg-blue-50 border-blue-100 text-blue-700",
                barClass: "bg-blue-500",
                borderClass: "border-l-blue-300",
                items: [
                  { term: "Total Views", def: "Times articles have been opened across all tenants. All-time cumulative." },
                  { term: "Helpful Rate", def: "Platform-wide percentage of article feedback marked helpful. Formula: (Helpful ÷ Total rated) × 100. Reflects KB quality across all organizations." },
                  { term: "Avg. Confidence", def: "Mean AI match score (0–100%) across all platform searches. A low average signals the KB is missing content for common queries." },
                  { term: "Total Searches", def: "Cumulative KB searches across the entire platform, all tenants." },
                  { term: "Knowledge Gaps count", def: "Total unresolved gap reports across all tenants. High numbers mean the KB needs more content — not an error state." },
                  { term: "pp (percentage points)", def: "Absolute difference between two percentages. Helpful rate rising from 60% to 65% is +5pp, not +8.3%." },
                  { term: "vs Yesterday", def: "Percentage change in today's search volume vs yesterday. Shows demand trends (+) or drops (−) across the platform." },
                ],
              },
              {
                category: "Users, Teams & Roles",
                badgeClass: "bg-green-50 border-green-100 text-green-700",
                barClass: "bg-green-500",
                borderClass: "border-l-green-300",
                items: [
                  { term: "Super Admin", def: "Platform-wide access across all tenants. Can manage organizations, users, articles, gaps, and view cross-tenant analytics. That's you." },
                  { term: "Admin", def: "Scoped to a single tenant. Manages articles, approves workflows, resolves gaps, and views tenant-level analytics." },
                  { term: "Agent", def: "Front-line support staff. Uses the KB to answer customer queries, reports gaps, and handles customer chat cases." },
                  { term: "Team", def: "A group of users within a tenant. Articles can be restricted to a team (Private), and workflow steps can require a specific team's sign-off." },
                  { term: "Separation of Duties", def: "An article's author cannot approve or publish their own work. Enforced automatically across all roles." },
                ],
              },
              {
                category: "Content & Workflows",
                badgeClass: "bg-amber-50 border-amber-100 text-amber-700",
                barClass: "bg-amber-500",
                borderClass: "border-l-amber-300",
                items: [
                  { term: "Article Status Flow", def: "Draft → In Review → Approved → Published → Archived. Articles must follow this sequence. Exception: Draft can go directly to Archived to discard a draft." },
                  { term: "Workflow Route", def: "A custom multi-step approval chain for articles. Each step can require a specific role, team, or named individual before the article advances." },
                  { term: "Audit Log", def: "Tamper-proof record of every action on the platform: who did what, to which resource, and when. Covers articles, users, gaps, and status changes." },
                  { term: "Rollback", def: "Reverting an article to a previous saved version via the Audit Log. Available when an incorrect change was published." },
                ],
              },
            ];
            const allTerms = sections.flatMap(s => s.items.map(i => ({ ...i, category: s.category, badgeClass: s.badgeClass, barClass: s.barClass })));
            const cats = sections.map(s => s.category);
            const filteredSections = sections
              .map(s => ({
                ...s,
                matchedItems: s.items.filter(item =>
                  !glossarySearch ||
                  item.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
                  item.def.toLowerCase().includes(glossarySearch.toLowerCase())
                ),
              }))
              .filter(s =>
                (glossaryCategory === "All" || s.category === glossaryCategory) &&
                s.matchedItems.length > 0
              );
            const totalFiltered = filteredSections.reduce((sum, s) => sum + s.matchedItems.length, 0);
            return (
              <div className="space-y-5">
                {/* Toolbar */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-zinc-500">Definitions for every term, metric, and feature across the platform.</p>
                    <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-600 flex-shrink-0">
                      {allTerms.length} terms
                    </span>
                  </div>
                  <div className="relative">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input type="text" placeholder="Search terms or definitions…" value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-10 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none transition-colors" />
                    {glossarySearch && (
                      <button type="button" onClick={() => setGlossarySearch("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-lg font-bold leading-none">×</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["All", ...cats].map(cat => (
                      <button key={cat} type="button" onClick={() => setGlossaryCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${glossaryCategory === cat ? "bg-zinc-950 text-white border-zinc-950" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900"}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Count + clear */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    Showing <span className="font-semibold text-zinc-600">{totalFiltered}</span> of {allTerms.length} terms
                    {glossaryCategory !== "All" && <> in <span className="font-semibold text-zinc-600">{glossaryCategory}</span></>}
                    {glossarySearch && <> matching <span className="font-semibold text-zinc-600">&ldquo;{glossarySearch}&rdquo;</span></>}
                  </p>
                  {(glossarySearch || glossaryCategory !== "All") && (
                    <button type="button" onClick={() => { setGlossarySearch(""); setGlossaryCategory("All"); }}
                      className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 transition-colors">Clear</button>
                  )}
                </div>
                {/* Section tables */}
                {filteredSections.length === 0 ? (
                  <div className="rounded-xl border border-zinc-100 bg-white py-14 text-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-zinc-300"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <p className="text-sm font-semibold text-zinc-500">No terms match your search.</p>
                    <p className="text-xs text-zinc-400 mt-1">Try a different keyword or clear the filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSections.map(section => (
                      <div key={section.category} className={`rounded-xl border border-zinc-100 bg-white shadow-sm overflow-hidden flex flex-col border-l-[3px] ${section.borderClass}`}>
                        <div className={`flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0 ${section.badgeClass}`}>
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${section.barClass}`} />
                          <span className="text-xs font-bold">{section.category}</span>
                          <span className="ml-auto text-[10px] font-semibold text-zinc-400 tabular-nums">{section.matchedItems.length}</span>
                        </div>
                        <div className="divide-y divide-zinc-50 flex-1">
                          {section.matchedItems.map(item => (
                            <div key={item.term} className="px-4 py-3 flex gap-4 hover:bg-zinc-50/60 transition-colors">
                              <div className="w-36 flex-shrink-0 pt-0.5">
                                <span className="text-[11px] font-bold text-zinc-900 leading-snug">{item.term}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-relaxed">{item.def}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* User Team Editor Popover Modal */}
      {editingUserTeams && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-955">Manage Teams for {editingUserTeams.name}</h3>
              <p className="text-xs text-zinc-500 font-semibold mt-1">
                Assign or revoke lines of business team memberships.
              </p>
            </div>
            
            <form onSubmit={handleSaveUserTeams} className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block mb-1">Select Assigned Teams</label>
                {teams.filter(t => t.tenant_id === editingUserTeams.tenant_id).length === 0 ? (
                  <div className="text-xs text-zinc-400 font-semibold italic p-3 border border-zinc-200 rounded bg-zinc-50">No teams exist for this organization.</div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsModalTeamsDropdownOpen(!isModalTeamsDropdownOpen)}
                      className="flex items-center justify-between w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-sm text-zinc-955 hover:bg-zinc-100 transition-colors text-left"
                    >
                      <span className="truncate text-xs font-semibold">
                        {modalSelectedTeams.length === 0
                          ? "Select Teams..."
                          : teams
                              .filter(t => modalSelectedTeams.includes(t.id))
                              .map(t => t.name)
                              .join(", ")}
                      </span>
                      <svg className="h-4 w-4 text-zinc-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isModalTeamsDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsModalTeamsDropdownOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 shadow-md max-h-36 overflow-y-auto space-y-1">
                          {teams.filter(t => t.tenant_id === editingUserTeams.tenant_id).map((t) => (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-700 hover:bg-zinc-50 p-2 rounded transition-colors">
                              <input
                                type="checkbox"
                                checked={modalSelectedTeams.includes(t.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setModalSelectedTeams([...modalSelectedTeams, t.id]);
                                  } else {
                                    setModalSelectedTeams(modalSelectedTeams.filter(id => id !== t.id));
                                  }
                                }}
                                className="accent-zinc-955"
                              />
                              <span className="truncate">{t.name}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUserTeams(null);
                    setIsModalTeamsDropdownOpen(false);
                  }}
                  className="rounded border border-zinc-250 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-650"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="rounded bg-zinc-955 hover:bg-zinc-800 px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  {modalSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

