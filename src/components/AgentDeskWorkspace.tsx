"use client";

import { useState } from "react";
import TroubleshootingPlayer from "@/components/TroubleshootingPlayer";
import { parseMarkdownToHtml } from "@/lib/markdown";

type AgentCase = {
  id: string;
  customer_name: string;
  subject: string;
  query_text: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  context: any;
  resolving_article_id: string | null;
  wait_started_at: string;
  resolved_at: string | null;
  agent?: { name: string } | null;
  resolving_article?: { title: string } | null;
};

type SearchResult = {
  article_id: string;
  title: string;
  category: string;
  match_score: number;
  status: string;
  language: string;
};

type AgentWorkspaceProps = {
  initialCases: AgentCase[];
  currentUserId: string;
  tenantId: string;
  todaySearches: number;
  helpfulnessRate: number | null;
};

export default function AgentDeskWorkspace({
  initialCases,
  currentUserId,
  tenantId,
  todaySearches,
  helpfulnessRate,
}: AgentWorkspaceProps) {
  const [cases, setCases] = useState<AgentCase[]>(initialCases);
  const [activeTab, setActiveTab] = useState<"waiting" | "active" | "resolved">("waiting");
  const [selectedCase, setSelectedCase] = useState<AgentCase | null>(null);

  // Search KB states
  const [kbQuery, setKbQuery] = useState("");
  const [kbResults, setKbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [gapLogged, setGapLogged] = useState(false);

  // Selected article detail state for resolution preview
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const filteredCases = cases.filter((c) => {
    if (activeTab === "waiting") return c.status === "waiting";
    if (activeTab === "active") return c.status === "active" && c.assigned_agent_id === currentUserId;
    return c.status === "resolved";
  });

  const handleClaimCase = async (caseId: string) => {
    try {
      const res = await fetch("/api/v1/cases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: caseId, claim: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to claim case");
      }

      const updated = await res.json();
      setCases(cases.map((c) => (c.id === caseId ? { ...c, ...updated } : c)));
      
      // Update selected case view
      const freshCase = { ...selectedCase, ...updated };
      setSelectedCase(freshCase);
      setActiveTab("active");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSearchKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbQuery.trim()) return;

    setSearching(true);
    setSearched(true);
    setGapLogged(false);
    setPreviewArticle(null);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          query: kbQuery.trim(),
          language: "en",
          channel: "agent",
        }),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setKbResults(data.results || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleLogGap = async () => {
    if (!kbQuery.trim()) return;
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: kbQuery.trim(),
          language: "en",
          channel: "agent",
        }),
      });
      if (res.ok) {
        setGapLogged(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewArticle = async (articleId: string) => {
    setLoadingArticle(true);
    try {
      const res = await fetch(`/api/v1/articles/${articleId}`);
      if (!res.ok) throw new Error("Failed to load article");
      const data = await res.json();
      setPreviewArticle(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingArticle(false);
    }
  };

  const handleResolveCase = async (caseId: string, articleId: string) => {
    try {
      const res = await fetch("/api/v1/cases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: caseId,
          status: "resolved",
          resolving_article_id: articleId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resolve case");
      }

      const updated = await res.json();
      setCases(cases.map((c) => (c.id === caseId ? { ...c, ...updated } : c)));
      setSelectedCase(null);
      setPreviewArticle(null);
      setKbResults([]);
      setKbQuery("");
      setSearched(false);
      alert("Case resolved successfully!");
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">My Queue Activity</span>
          <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">
            {cases.filter((c) => c.assigned_agent_id === currentUserId && c.status === "active").length} Active
          </h3>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Today's Searches</span>
          <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">{todaySearches} Queries</h3>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Helpfulness Score</span>
          <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">
            {helpfulnessRate !== null ? `${helpfulnessRate}% Helpful` : "Pending Integration"}
          </h3>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cases List Pane */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455 text-left">Case Ticket Queue</h3>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-zinc-200 text-xs">
            <button
              onClick={() => {
                setActiveTab("waiting");
                setSelectedCase(null);
              }}
              className={`flex-1 py-3 font-bold border-b-2 transition-all ${
                activeTab === "waiting" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
              }`}
            >
              Waiting ({cases.filter((c) => c.status === "waiting").length})
            </button>
            <button
              onClick={() => {
                setActiveTab("active");
                setSelectedCase(null);
              }}
              className={`flex-1 py-3 font-bold border-b-2 transition-all ${
                activeTab === "active" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
              }`}
            >
              Assigned ({cases.filter((c) => c.status === "active" && c.assigned_agent_id === currentUserId).length})
            </button>
            <button
              onClick={() => {
                setActiveTab("resolved");
                setSelectedCase(null);
              }}
              className={`flex-1 py-3 font-bold border-b-2 transition-all ${
                activeTab === "resolved" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
              }`}
            >
              Closed ({cases.filter((c) => c.status === "resolved").length})
            </button>
          </div>

          {/* List items */}
          <div className="divide-y divide-zinc-150 max-h-[480px] overflow-y-auto">
            {filteredCases.length === 0 ? (
              <div className="p-8 text-center text-zinc-450 text-xs font-semibold">No cases in this queue.</div>
            ) : (
              filteredCases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCase(c);
                    setPreviewArticle(null);
                    setKbResults([]);
                    setKbQuery(c.query_text);
                    setSearched(false);
                  }}
                  className={`w-full p-4 text-left transition-colors flex flex-col gap-2 hover:bg-zinc-50 ${
                    selectedCase?.id === c.id ? "bg-zinc-50/80 border-l-4 border-zinc-900" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 font-mono">ID: {c.id.slice(0, 8)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                        c.priority === "high"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : c.priority === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : c.priority === "low"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-zinc-50 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {c.priority}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-900 line-clamp-1">{c.subject}</h4>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium gap-2">
                    <span className="truncate">Customer: {c.customer_name}</span>
                    <span className="shrink-0">{new Date(c.wait_started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Case Detail Workspace Pane */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6 text-left min-h-[530px]">
          {selectedCase ? (
            <div className="space-y-6">
              {/* Ticket Details */}
              <div className="border-b border-zinc-150 pb-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base font-extrabold text-zinc-950">Active Ticket Workspace</h3>
                  <div className="flex items-center gap-2">
                    {selectedCase.status === "waiting" ? (
                      <button
                        onClick={() => handleClaimCase(selectedCase.id)}
                        className="rounded bg-zinc-950 hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                      >
                        Claim Ticket
                      </button>
                    ) : selectedCase.status === "active" ? (
                      <span className="rounded bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-white uppercase border border-zinc-950">
                        Assigned to Me
                      </span>
                    ) : (
                      <div className="text-[10px] font-bold text-green-700 border border-green-200 bg-green-50 px-2.5 py-1 rounded">
                        Resolved (Article: {selectedCase.resolving_article?.title})
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Customer</span>
                    <strong className="text-zinc-800">{selectedCase.customer_name}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Subject</span>
                    <strong className="text-zinc-800 line-clamp-1">{selectedCase.subject}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Priority</span>
                    <span
                      className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                        selectedCase.priority === "high"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : selectedCase.priority === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : selectedCase.priority === "low"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-zinc-50 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {selectedCase.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Wait Started</span>
                    <strong className="text-zinc-800">
                      {new Date(selectedCase.wait_started_at).toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Customer Query</span>
                  <p className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-800 font-medium leading-relaxed italic">
                    "{selectedCase.query_text}"
                  </p>
                </div>
              </div>

              {/* Case KB Search Workspace */}
              {selectedCase.status === "active" && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Workspace Search</h4>
                    <form onSubmit={handleSearchKB} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search articles across all workflow statuses..."
                        value={kbQuery}
                        onChange={(e) => setKbQuery(e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-800 focus:border-zinc-950 focus:outline-hidden transition-all shadow-xs"
                      />
                      <button
                        type="submit"
                        disabled={searching}
                        className="rounded bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
                      >
                        Search KB
                      </button>
                    </form>
                  </div>

                  {/* Results List */}
                  {searched && (
                    <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-zinc-200 pb-2">
                        <span className="font-bold text-zinc-800">Matching Articles ({kbResults.length})</span>
                        {kbResults.length === 0 && (
                          <button
                            onClick={handleLogGap}
                            disabled={gapLogged}
                            className="rounded border border-zinc-250 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-700 transition-all disabled:opacity-50"
                          >
                            {gapLogged ? "Gap Logged ✔" : "Flag Knowledge Gap 🚨"}
                          </button>
                        )}
                      </div>

                      {searching ? (
                        <div className="text-center text-xs text-zinc-500 py-4 font-semibold animate-pulse">
                          Fetching KB resources...
                        </div>
                      ) : kbResults.length === 0 ? (
                        <div className="text-center text-xs text-zinc-450 py-4 font-semibold">
                          No matching articles found. You can flag a knowledge gap with one click.
                        </div>
                      ) : (
                        <div className="divide-y divide-zinc-200 max-h-[180px] overflow-y-auto text-xs">
                          {kbResults.map((r) => (
                            <div key={r.article_id} className="py-2.5 flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <strong className="text-zinc-800 line-clamp-1">{r.title}</strong>
                                  <span
                                    className={`rounded px-1 text-[8px] font-bold border ${
                                      r.status === "Published"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-medium">Category: {r.category}</div>
                              </div>
                              <button
                                onClick={() => handlePreviewArticle(r.article_id)}
                                className="rounded border border-zinc-300 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 shrink-0"
                              >
                                Select
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Article Preview Drawer */}
                  {loadingArticle && (
                    <div className="text-center text-xs text-zinc-500 py-6 font-semibold animate-pulse border border-zinc-200 rounded-lg p-6 bg-white">
                      Loading article content details...
                    </div>
                  )}

                  {previewArticle && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-5 shadow-inner">
                      <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">Preview Content</h5>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold border ${
                                previewArticle.status === "Published"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {previewArticle.status}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold text-zinc-850 mt-1">{previewArticle.title}</h4>
                        </div>
                        <button
                          onClick={() => handleResolveCase(selectedCase.id, previewArticle.id)}
                          className="rounded bg-green-600 hover:bg-green-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all"
                        >
                          Resolve Ticket
                        </button>
                      </div>

                      {/* Render short answer & detailed steps */}
                      {previewArticle.variants?.find((v: any) => v.channel === "agent")?.short_answer && (
                        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs">
                          <strong className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Short Answer</strong>
                          <p className="text-zinc-700 leading-relaxed font-medium">
                            {previewArticle.variants.find((v: any) => v.channel === "agent").short_answer}
                          </p>
                        </div>
                      )}

                      <div 
                        className="text-xs text-zinc-750 font-medium leading-relaxed max-h-[150px] overflow-y-auto whitespace-pre-wrap border-b border-zinc-100 pb-4"
                        dangerouslySetInnerHTML={{
                          __html: parseMarkdownToHtml(
                            previewArticle.variants?.find((v: any) => v.channel === "agent")?.detailed_steps || 
                            previewArticle.variants?.find((v: any) => v.channel === "default")?.detailed_steps || 
                            "No detailed content available."
                          )
                        }}
                      />

                      {/* Copy-Ready Macro */}
                      {previewArticle.variants?.find((v: any) => v.channel === "agent")?.copy_ready_macro && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase block">Ready-to-Paste Macro</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(previewArticle.variants.find((v: any) => v.channel === "agent").copy_ready_macro);
                                alert("Macro copied to clipboard!");
                              }}
                              className="rounded bg-zinc-900 hover:bg-zinc-850 px-2 py-1 text-[9px] font-bold text-white"
                            >
                              Copy Macro Text
                            </button>
                          </div>
                          <pre className="rounded bg-zinc-950 p-3 font-mono text-[10px] text-zinc-300 overflow-x-auto max-h-[80px] shadow-inner border border-zinc-850">
                            {previewArticle.variants.find((v: any) => v.channel === "agent").copy_ready_macro}
                          </pre>
                        </div>
                      )}

                      {/* Troubleshooting Player */}
                      {previewArticle.variants?.find((v: any) => v.channel === "agent")?.troubleshooting_flow && (
                        <div className="border-t border-zinc-100 pt-4">
                          <TroubleshootingPlayer
                            flow={previewArticle.variants.find((v: any) => v.channel === "agent").troubleshooting_flow}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-center py-20 space-y-2">
              <span className="text-3xl">🎫</span>
              <h4 className="text-sm font-bold text-zinc-500">No Ticket Selected</h4>
              <p className="text-xs text-zinc-400 max-w-xs font-semibold leading-relaxed">
                Choose a ticket from the left panel queue, claim it, and resolve it using our integrated search workspace.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
