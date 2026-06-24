"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  branding: any;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  tenant_id: string;
};

type SearchResult = {
  article_id: string;
  title: string;
  category: string;
  match_score: number;
  status: string;
  language: string;
};

type SearchWorkspaceProps = {
  tenants: Tenant[];
  initialCategories: Category[];
  isLoggedIn: boolean;
  userRole?: string;
  userName?: string;
  hideBrandSelector?: boolean;
  pinnedArticleIds?: string[];
  onTogglePin?: (articleId: string) => void;
  feedbackSource?: string;
  feedbackChannel?: string;
  feedbackPlaceholder?: string;
  feedbackTitle?: string;
  feedbackSubtitle?: string;
  agentMode?: boolean;
};

export default function CustomerSearchWorkspace({
  tenants,
  initialCategories,
  isLoggedIn,
  userRole,
  userName,
  hideBrandSelector = false,
  pinnedArticleIds = [],
  onTogglePin,
  feedbackSource = "customer",
  feedbackChannel = "default",
  feedbackPlaceholder = "Describe what you were trying to find...",
  feedbackTitle = "Help us improve",
  feedbackSubtitle = "Tell us what you were looking for — our content team will create a guide to help you.",
  agentMode = false,
}: SearchWorkspaceProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(tenants[0] || null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<{ id: string; name: string }[]>([]);
  const [gapLogged, setGapLogged] = useState(false);
  const [escalation, setEscalation] = useState<any>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Filter categories by the active tenant
  const activeCategories = initialCategories.filter((c) => c.tenant_id === selectedTenant?.id);
  const brandingColor = selectedTenant?.branding?.primaryColor || "#09090B";

  // Reset search state on tenant switch
  useEffect(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setGapLogged(false);
    setEscalation(null);
    setFeedbackText("");
    setFeedbackSubmitted(false);
  }, [selectedTenant]);

  const triggerSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearched(true);
    setGapLogged(false);
    setEscalation(null);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": selectedTenant.id,
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          language: "en",
          channel: "default",
        }),
      });

      if (!res.ok) {
        throw new Error("Search failed");
      }

      const data = await res.json();
      setResults(data.results || []);
      setGapLogged(data.gap_logged || false);
      setSuggestedCategories(data.suggested_categories || []);
      setEscalation(data.escalation || null);
    } catch (error) {
      console.error("Search Error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackText("");
    setFeedbackSubmitted(false);
    triggerSearch(query);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || submittingFeedback || !selectedTenant) return;
    setSubmittingFeedback(true);
    try {
      await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: query.trim(),
          comment: feedbackText.trim(),
          source: feedbackSource,
          channel: feedbackChannel,
          tenant_id: selectedTenant.id,
        }),
      });
      setFeedbackSubmitted(true);
    } catch {
      // silently fail — customer-facing
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // ── Agent Mode UI ────────────────────────────────────────────────────────────
  if (agentMode) {
    return (
      <div className="w-full flex flex-col gap-6">

        {/* Search bar */}
        <form onSubmit={handleSearchForm} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/5 shadow-sm transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder={`Search ${selectedTenant?.name || ""} knowledge base…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setSearched(false); setResults([]); }} className="text-zinc-300 hover:text-zinc-500 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 text-sm font-bold text-white shadow-sm transition-all w-full sm:w-auto"
          >
            {searching ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" /> Searching…</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Search</>
            )}
          </button>
        </form>

        {/* Category pills */}
        {!searched && activeCategories.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Browse by Category</p>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-all"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
                  </svg>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {searching && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700 inline-block" />
            <p className="text-sm font-semibold text-zinc-500">Searching articles…</p>
          </div>
        )}

        {!searching && searched && results.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-extrabold text-zinc-800">No articles matched</p>
                <p className="text-xs text-zinc-400 mt-1">No results for <span className="font-semibold text-zinc-600">"{query}"</span></p>
              </div>
              {gapLogged && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-100 px-3 py-1 text-[10px] font-bold text-green-700">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Gap auto-logged
                </div>
              )}
            </div>

            {/* Report gap form */}
            <div className="border-t border-zinc-100 bg-zinc-50/60 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                    <path d="M12 9v4"/><path d="M12 17h.01"/>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-extrabold text-zinc-800">{feedbackTitle}</p>
                  <p className="text-[10px] text-zinc-400">{feedbackSubtitle}</p>
                </div>
              </div>
              {feedbackSubmitted ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-4 py-3">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-xs font-bold text-green-700">Gap report submitted successfully.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder={feedbackPlaceholder}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all"
                  />
                  <button
                    type="button"
                    disabled={submittingFeedback || !feedbackText.trim()}
                    onClick={handleSubmitFeedback}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white transition-colors"
                  >
                    {submittingFeedback ? (
                      <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" /> Submitting…</>
                    ) : "Submit Gap Report"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!searching && searched && results.length > 0 && (
          <div className="space-y-3">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                {results.length} result{results.length !== 1 ? "s" : ""} — ranked by relevance
              </p>
              <button
                type="button"
                onClick={() => { setSearched(false); setResults([]); setQuery(""); }}
                className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
              >Clear</button>
            </div>

            {/* Result cards — 2-col grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {results.map((art) => {
                const isPinned = pinnedArticleIds.includes(art.article_id);
                const score = Math.round(art.match_score * 100);
                const scoreColor = score >= 70 ? "bg-green-100 text-green-700" : score >= 40 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500";
                return (
                  <div key={art.article_id} className="group flex flex-col rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all">
                    <Link href={`/articles/${art.article_id}`} className="flex-1 p-4 space-y-2.5 block">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md bg-zinc-50 border border-zinc-200 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-zinc-500">
                          {art.category}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${scoreColor}`}>
                          {score}% match
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-600 leading-snug transition-colors line-clamp-2">
                        {art.title}
                      </h4>
                    </Link>
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100">
                      <span className="text-[9px] font-mono text-zinc-400">{art.language.toUpperCase()} · {art.status}</span>
                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={() => onTogglePin(art.article_id)}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-extrabold transition-all ${
                            isPinned
                              ? "border-zinc-800 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-400 hover:text-zinc-700"
                          }`}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                          </svg>
                          {isPinned ? "Pinned" : "Pin"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Customer Mode UI (unchanged) ─────────────────────────────────────────────
  return (
    <div className="w-full space-y-12">
      {/* Welcome & Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-zinc-200">
        <div className="text-left">
          <h2 className="text-xl font-extrabold text-zinc-950">How can we help you today?</h2>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Search or browse published support articles.
          </p>
        </div>
        {!hideBrandSelector && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Brand:</span>
            <div className="relative inline-block text-left">
              <select
                value={selectedTenant?.id}
                onChange={(e) => {
                  const found = tenants.find((t) => t.id === e.target.value);
                  if (found) setSelectedTenant(found);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 focus:outline-hidden transition-all shadow-xs cursor-pointer pr-8 appearance-none"
                style={{ borderLeft: `4px solid ${brandingColor}` }}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                ▼
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Search Panel */}
      <div className="max-w-2xl mx-auto space-y-6">
        <form onSubmit={handleSearchForm} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={`Search ${selectedTenant?.name} help resources...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:outline-hidden transition-all shadow-xs"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-zinc-950 hover:bg-zinc-850 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {activeCategories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.id}`}
              className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-650 hover:text-zinc-950 transition-colors shadow-2xs"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Results / Zero Results States */}
      <div className="space-y-6">
        {searched && (
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h3 className="text-sm font-bold text-zinc-900">
              {searching ? "Searching resources..." : `Search Results (${results.length})`}
            </h3>
            {results.length > 0 && (
              <span className="text-xs text-zinc-455 font-semibold">
                Ranked by relevance score
              </span>
            )}
          </div>
        )}

        {searching ? (
          <div className="py-12 text-center text-zinc-500 font-medium text-sm">
            <span className="inline-block animate-pulse">Filtering articles...</span>
          </div>
        ) : searched && results.length === 0 ? (
          /* ZERO RESULT RECOVERY STATE */
          <div className="rounded-xl border border-zinc-200 bg-white p-8 sm:p-10 shadow-xs max-w-2xl mx-auto space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-400 font-bold text-sm">
                🔍
              </div>
              <h4 className="text-base font-extrabold text-zinc-950">No Results Found</h4>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                We couldn't find any articles matching <strong className="text-zinc-800">"{query}"</strong>.
              </p>
            </div>

            {gapLogged && (
              <div className="rounded-lg border border-zinc-150 bg-zinc-50 p-4 text-xs font-semibold text-zinc-650 flex items-start gap-2.5">
                <span className="text-green-500">✔</span>
                <div>
                  <p className="text-zinc-950 font-bold">Knowledge Gap Registered</p>
                  <p className="mt-0.5 font-medium text-zinc-500">This query has been logged automatically to help our content team write a resolving guide.</p>
                </div>
              </div>
            )}

            {/* Customer feedback form — always shown after zero-result search */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-800">{feedbackTitle}</p>
              <p className="text-[11px] text-zinc-500 font-medium">{feedbackSubtitle}</p>
              {feedbackSubmitted ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-700">
                  <span className="text-green-500">✔</span> Thank you for your feedback!
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder={feedbackPlaceholder}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs resize-none focus:outline-none focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    disabled={submittingFeedback || !feedbackText.trim()}
                    onClick={handleSubmitFeedback}
                    className="rounded-lg bg-zinc-950 hover:bg-zinc-850 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    {submittingFeedback ? "Sending…" : "Send Feedback"}
                  </button>
                </div>
              )}
            </div>

            {suggestedCategories.length > 0 && (
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-450">Try Browsing Categories:</h5>
                <div className="flex flex-wrap gap-2">
                  {suggestedCategories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/categories/${c.id}`}
                      className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors shadow-2xs"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {escalation && (
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-450">Still Need Help?</h5>
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-xs font-medium text-red-800 flex items-center justify-between gap-4 flex-wrap">
                  <p className="font-semibold">Escalate case to our active Customer Support Agent Desk.</p>
                  <a
                    href={`mailto:${escalation.contact_email}`}
                    className="rounded bg-zinc-950 hover:bg-zinc-800 px-3 py-1.5 text-[10px] font-bold text-white shadow-xs transition-all text-center whitespace-nowrap"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* RESULTS FOUND STATE */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((art) => {
              const isPinned = pinnedArticleIds.includes(art.article_id);
              return (
                <div key={art.article_id} className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:border-zinc-350 hover:-translate-y-0.5 flex flex-col">
                  <Link
                    href={`/articles/${art.article_id}`}
                    className="block p-6 flex-1 text-left space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border border-zinc-200">
                        {art.category}
                      </span>
                      <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200 uppercase">
                        {art.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-650 transition-colors line-clamp-2 leading-snug">
                      {art.title}
                    </h4>
                  </Link>

                  <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 text-[10px] text-zinc-400 font-semibold font-mono">
                    <span>Score: <strong className="text-zinc-800">{(art.match_score * 100).toFixed(0)}%</strong></span>
                    {onTogglePin ? (
                      <button
                        type="button"
                        onClick={() => onTogglePin(art.article_id)}
                        title={isPinned ? "Unpin article" : "Pin for quick access"}
                        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold transition-all not-font-mono ${
                          isPinned
                            ? "border-zinc-800 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                        </svg>
                        {isPinned ? "Pinned" : "Pin"}
                      </button>
                    ) : (
                      <span>ID: {art.article_id.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
