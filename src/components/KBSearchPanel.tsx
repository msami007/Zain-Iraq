"use client";

import { useState } from "react";

type SearchResult = {
  article_id: string;
  title: string;
  category: string;
  match_score: number;
  status: string;
  language: string;
};

type ArticleDetail = {
  id: string;
  title: string;
  status: string;
  category: { name: string } | null;
  variants: Array<{
    channel: string;
    short_answer: string;
    detailed_steps: string;
  }>;
};

const STATUS_STYLES: Record<string, string> = {
  Published: "bg-green-50 text-green-700 border-green-200",
  Approved:  "bg-blue-50 text-blue-700 border-blue-200",
  InReview:  "bg-amber-50 text-amber-700 border-amber-200",
  Draft:     "bg-zinc-100 text-zinc-600 border-zinc-200",
  Archived:  "bg-red-50 text-red-600 border-red-200",
};

export default function KBSearchPanel({ tenantId }: { tenantId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [gapLogged, setGapLogged] = useState(false);

  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setGapLogged(false);
    setSelectedArticle(null);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ query: query.trim(), language: "en", channel: "agent" }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
      if (data.gap_logged) setGapLogged(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenArticle = async (articleId: string) => {
    setLoadingArticle(true);
    setSelectedArticle(null);
    try {
      const res = await fetch(`/api/v1/articles/${articleId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error("Failed to load article");
      const data = await res.json();
      setSelectedArticle(data);
    } catch {
      alert("Could not load article.");
    } finally {
      setLoadingArticle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge base articles by title, category, or keyword..."
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all shadow-xs"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition-all"
        >
          {searching ? "Searching..." : "Search"}
        </button>
        {searched && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setSearched(false); setGapLogged(false); setSelectedArticle(null); }}
            className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-all"
          >
            Clear
          </button>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Results Panel */}
        <div>
          {!searched && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 mx-auto">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-zinc-500">Type a query above to search</p>
              <p className="text-xs text-zinc-400 font-medium">
                You can search all articles — including drafts, in-review, and archived — not just published ones.
              </p>
            </div>
          )}

          {searched && searching && (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 font-semibold animate-pulse">
              Searching articles...
            </div>
          )}

          {searched && !searching && results.length === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center space-y-2">
              <p className="text-sm font-bold text-zinc-600">No articles matched</p>
              <p className="text-xs text-zinc-400 font-medium">
                {gapLogged ? "A knowledge gap has been logged automatically." : "Try a different query."}
              </p>
            </div>
          )}

          {searched && !searching && results.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
              <div className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700">{results.length} article{results.length !== 1 ? "s" : ""} found</span>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Sorted by relevance</span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.article_id}
                    type="button"
                    onClick={() => handleOpenArticle(r.article_id)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-zinc-50 transition-colors flex items-start justify-between gap-3 ${
                      selectedArticle?.id === r.article_id ? "bg-zinc-50 border-l-2 border-zinc-900" : ""
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2">{r.title}</div>
                      <div className="text-[11px] text-zinc-500 font-medium">{r.category}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${STATUS_STYLES[r.status] || "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                        {r.status}
                      </span>
                      <span className="text-[10px] font-bold text-green-600">{Math.round(r.match_score * 100)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Article Preview Panel */}
        <div>
          {loadingArticle && (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 font-semibold animate-pulse">
              Loading article...
            </div>
          )}

          {!loadingArticle && !selectedArticle && searched && results.length > 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center space-y-2">
              <p className="text-sm font-bold text-zinc-500">Select an article to preview</p>
              <p className="text-xs text-zinc-400 font-medium">Click any result on the left to read its content here.</p>
            </div>
          )}

          {!loadingArticle && selectedArticle && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
              {/* Header */}
              <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${STATUS_STYLES[selectedArticle.status] || "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                    {selectedArticle.status}
                  </span>
                  {selectedArticle.category && (
                    <span className="text-[10px] text-zinc-400 font-semibold">{selectedArticle.category.name}</span>
                  )}
                </div>
                <h3 className="text-sm font-extrabold text-zinc-950 leading-snug">{selectedArticle.title}</h3>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                {(() => {
                  const agentVariant = selectedArticle.variants?.find((v) => v.channel === "agent");
                  const defaultVariant = selectedArticle.variants?.find((v) => v.channel === "default");
                  const variant = agentVariant || defaultVariant;

                  if (!variant) {
                    return <p className="text-xs text-zinc-400 italic">No content available for this article.</p>;
                  }

                  return (
                    <>
                      {variant.short_answer && (
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                          <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Short Answer</span>
                          <p className="text-xs text-zinc-700 font-medium leading-relaxed">{variant.short_answer}</p>
                        </div>
                      )}
                      {variant.detailed_steps && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-2">Detailed Steps</span>
                          <div className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium">
                            {variant.detailed_steps}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
