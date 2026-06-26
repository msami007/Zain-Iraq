"use client";

import { useState } from "react";
import Link from "next/link";

type ArticleProps = {
  id: string;
  title: string;
  status: string;
  language: string;
  category: string;
  categoryId?: string;
  shortAnswer: string;
  copyMacro: string;
  numberedSteps: string[];
  internalNote: string;
  deliveryChannels: string[];
  helpfulPct: number | null;
  totalFeedback: number;
};

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r}
          fill="none" stroke={color}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: "14px", fontWeight: 800, fill: "#18181b" }}>
          {pct}%
        </text>
      </svg>
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        {pct >= 80 ? "High confidence" : pct >= 60 ? "Moderate" : "Low confidence"}
      </span>
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  Published: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100",
  Draft:     "bg-zinc-100 text-zinc-600 border-zinc-200 ring-zinc-100",
  Review:    "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",
  Archived:  "bg-red-50 text-red-600 border-red-200 ring-red-100",
};

export default function AgentArticleClient({
  article,
  backQuery,
  backCategoryId,
}: {
  article: ArticleProps;
  backQuery?: string;
  backCategoryId?: string;
}) {
  const [copied, setCopied]         = useState(false);
  const [feedback, setFeedback]     = useState<"helpful" | "missing" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");

  const copy = () => {
    navigator.clipboard.writeText(article.copyMacro).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const submitFeedback = async (helpful: boolean) => {
    if (feedback || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: article.id, helpful, channel: "agent" }),
      });
      setFeedback(helpful ? "helpful" : "missing");
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const submitMissingFeedback = async (comment: string) => {
    if (feedback || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: article.id, helpful: false, comment, channel: "agent" }),
      });

      await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: `Missing info on article: ${article.title}`,
          comment: comment.trim(),
          source: "article_flag",
          flagged_article_id: article.id,
          channel: "agent",
        }),
      });

      setFeedback("missing");
      setShowCommentModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const pillClass = STATUS_PILL[article.status] ?? STATUS_PILL.Draft;
  const hasContent = article.copyMacro || article.numberedSteps.length > 0 || article.internalNote;

  // Breadcrumb back navigation
  const backHref = backCategoryId
    ? `/categories/${backCategoryId}${backQuery ? `?q=${encodeURIComponent(backQuery)}` : ""}`
    : backQuery
    ? `/agent?q=${encodeURIComponent(backQuery)}&tab=search`
    : "/agent";
  const backLabel = backCategoryId
    ? article.category
    : backQuery
    ? "Back to results"
    : "Dashboard";
  const sidebarBackLabel = backCategoryId
    ? `Back to ${article.category}`
    : backQuery
    ? "Back to results"
    : "Back to workspace";

  return (
    <div className="min-h-screen bg-[#f8f8f9] font-sans">

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-screen-xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 shrink-0 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
              {backLabel}
            </Link>
            <span className="text-zinc-300 select-none">/</span>
            <span className="text-xs font-semibold text-zinc-500 truncate max-w-[280px]">{article.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pillClass}`}>
              {article.status}
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {article.language}
            </span>
            <a
              href={`/articles/${article.id}?view=guest`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Guest view
            </a>
          </div>
        </div>
      </header>

      {/* ── Page body ── */}
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

          {/* ── LEFT: Main content ── */}
          <div className="min-w-0 space-y-6">

            {/* Article header */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm px-8 py-7">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pillClass}`}>
                  {article.status}
                </span>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {article.category}
                </span>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {article.language.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 leading-snug mb-3">
                {article.title}
              </h1>
              {article.shortAnswer && (
                <p className="text-sm text-zinc-500 leading-relaxed border-t border-zinc-100 pt-3 mt-3">
                  {article.shortAnswer}
                </p>
              )}
            </div>

            {/* No content notice */}
            {!hasContent && (
              <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm px-8 py-12 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 mb-4">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-500">No structured content available for the agent channel.</p>
                <p className="text-xs text-zinc-400 mt-1">Check the default or agent variant in the admin panel.</p>
              </div>
            )}

            {/* Copy-ready answer */}
            {article.copyMacro && (
              <section className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <h2 className="text-sm font-bold text-zinc-900">Copy-ready answer</h2>
                  </div>
                  <button
                    type="button"
                    onClick={copy}
                    className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      copied
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="px-8 py-6">
                  <p className="text-sm text-zinc-700 leading-relaxed">{article.copyMacro}</p>
                </div>
              </section>
            )}

            {/* Troubleshooting procedure */}
            {article.numberedSteps.length > 0 && (
              <section className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-8 py-5 border-b border-zinc-100">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-zinc-900">Troubleshooting procedure</h2>
                  <span className="ml-auto text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{article.numberedSteps.length} steps</span>
                </div>
                <div className="px-8 py-6 space-y-5">
                  {article.numberedSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white text-[11px] font-extrabold mt-0.5 tabular-nums">
                        {i + 1}
                      </span>
                      <p className="text-sm text-zinc-700 leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Internal operational note */}
            {article.internalNote && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-8 py-5 border-b border-amber-200/60">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-amber-900">Internal operational note</h2>
                  <span className="ml-auto text-[10px] font-bold text-amber-600 uppercase tracking-wider">Agents only</span>
                </div>
                <div className="px-8 py-6">
                  <p className="text-sm text-amber-900 leading-relaxed">{article.internalNote}</p>
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT: Sticky sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-[72px]">

            {/* Delivery channels */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Delivery channels</h3>
              {article.deliveryChannels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {article.deliveryChannels.map((ch) => (
                    <span key={ch} className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">No channels configured</p>
              )}
            </div>

            {/* Helpfulness rate */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Helpfulness Rate</h3>
                {article.totalFeedback > 0 && (
                  <span className="text-[10px] font-semibold text-zinc-400">{article.totalFeedback} rating{article.totalFeedback !== 1 ? "s" : ""}</span>
                )}
              </div>
              <div className="flex justify-center">
                {article.helpfulPct !== null ? (
                  <ConfidenceRing pct={article.helpfulPct} />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#f4f4f5" strokeWidth="7" strokeDasharray="5 3" />
                      <text x="40" y="36" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: "9px", fontWeight: 700, fill: "#a1a1aa" }}>No</text>
                      <text x="40" y="47" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: "9px", fontWeight: 700, fill: "#a1a1aa" }}>ratings</text>
                    </svg>
                    <p className="text-[10px] text-zinc-400 text-center leading-snug">
                      No customer feedback yet.<br/>Rate improves as customers rate this article.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer feedback */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Customer feedback</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {article.helpfulPct !== null
                    ? `${article.helpfulPct}% helpful · ${article.totalFeedback} rating${article.totalFeedback !== 1 ? "s" : ""}`
                    : "No ratings yet"}
                </p>
              </div>

              {feedback ? (
                <div className={`rounded-xl border px-4 py-3 text-xs font-semibold leading-snug ${
                  feedback === "helpful"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  {feedback === "helpful"
                    ? "Thanks for the positive feedback!"
                    : "Flagged for review — Knowledge Gaps notified."}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => submitFeedback(true)}
                    disabled={submitting}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition-all disabled:opacity-40"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCommentModal(true)}
                    disabled={submitting}
                    className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition-all disabled:opacity-40"
                  >
                    Missing info
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <Link
              href={backHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 px-4 py-3 text-xs font-bold text-white shadow-sm transition-all"
            >
              {sidebarBackLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>

        </div>
      </div>
      {showCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-955">Flag Article: Missing Info</h3>
              <p className="text-xs text-zinc-500 font-semibold mt-1">
                Please describe what information is missing or needs updating in this article.
              </p>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              await submitMissingFeedback(commentText);
            }} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block mb-1.5">Comments / Feedback</label>
                <textarea
                  required
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full rounded-lg border border-zinc-250 bg-zinc-50 px-3 py-2 text-xs text-zinc-955 focus:border-zinc-955 focus:bg-white focus:outline-none"
                  placeholder="e.g. The procedure says to use option B, but option B has been renamed to option C..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCommentModal(false)}
                  className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-55 px-4 py-2 text-xs font-bold text-white transition-all"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
