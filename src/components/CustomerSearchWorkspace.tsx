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
};

export default function CustomerSearchWorkspace({
  tenants,
  initialCategories,
  isLoggedIn,
  userRole,
  userName,
}: SearchWorkspaceProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(tenants[0] || null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<{ id: string; name: string }[]>([]);
  const [gapLogged, setGapLogged] = useState(false);
  const [escalation, setEscalation] = useState<any>(null);

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
  }, [selectedTenant]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

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
          query: query.trim(),
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
      </div>

      {/* Main Search Panel */}
      <div className="max-w-2xl mx-auto space-y-6">
        <form onSubmit={handleSearch} className="flex gap-2">
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
            className="rounded-lg bg-zinc-950 hover:bg-zinc-850 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {activeCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setQuery(c.name);
                setTimeout(() => {
                  const form = document.querySelector("form");
                  form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                }, 50);
              }}
              className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors shadow-2xs"
            >
              {c.name}
            </button>
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

            {suggestedCategories.length > 0 && (
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-450">Try Browsing Categories:</h5>
                <div className="flex flex-wrap gap-2">
                  {suggestedCategories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setQuery(c.name);
                        setTimeout(() => {
                          const form = document.querySelector("form");
                          form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                        }, 50);
                      }}
                      className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors shadow-2xs"
                    >
                      {c.name}
                    </button>
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
            {results.map((art) => (
              <Link
                key={art.article_id}
                href={`/articles/${art.article_id}`}
                className="group relative rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-zinc-350 hover:-translate-y-0.5 text-left flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
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
                </div>
                <div className="mt-6 flex items-center justify-between pt-3 border-t border-zinc-100 text-[10px] text-zinc-400 font-semibold font-mono">
                  <span>Score: <strong className="text-zinc-800">{(art.match_score * 100).toFixed(0)}%</strong></span>
                  <span>ID: {art.article_id.slice(0, 8)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
