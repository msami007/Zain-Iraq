import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleFeedbackForm from "@/components/ArticleFeedbackForm";
import { ArticleStatus, Channel } from "@prisma/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    token?: string;
    channel?: string;
  }>;
};

export default async function ArticleDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token, channel } = await searchParams;

  const session = await auth();
  const user = session?.user;

  // Fetch the article with relations
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { id: true, name: true } },
      variants: true,
    },
  });

  if (!article) {
    notFound();
  }

  // Access Control Validation
  let hasAccess = false;

  // - Rule A: If article is Published, anyone has access
  if (article.status === ArticleStatus.Published) {
    hasAccess = true;
  }

  // - Rule B: If a guest link token is provided, verify it
  if (!hasAccess && token) {
    const guestLink = await prisma.guestLink.findUnique({
      where: { token },
    });
    if (guestLink && guestLink.article_id === article.id && !guestLink.revoked) {
      hasAccess = true;
    }
  }

  // - Rule C: If the user is logged in (Agent/Admin/SuperAdmin), they can view all articles
  if (!hasAccess && user) {
    hasAccess = true;
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-zinc-900 font-sans">
        <div className="max-w-md text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 mb-6">
            🔒
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">Article Unavailable</h1>
          <p className="mt-2 text-sm text-zinc-500 font-medium">
            This article is either unpublished, requires a secure token to access, or is scoped to a different organization.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Determine active variant channel
  const selectedChannel = (channel || "default") as Channel;
  
  // Guard: Restrict agent variant to logged-in users only
  const showAgentChannel = user?.role === "Agent" || user?.role === "Admin" || user?.role === "SuperAdmin";
  const activeChannel = (selectedChannel === "agent" && !showAgentChannel) ? "default" : selectedChannel;

  // Locate the variant content
  const activeVariant = article.variants.find((v) => v.channel === activeChannel);
  const defaultVariant = article.variants.find((v) => v.channel === "default");

  // Fallback check
  const isFallback = activeChannel !== "default" && (!activeVariant || (!activeVariant.detailed_steps && !activeVariant.short_answer));
  const displayVariant = isFallback ? defaultVariant : activeVariant;

  const contentBody = displayVariant?.detailed_steps || "No content provided.";
  const shortAnswer = displayVariant?.short_answer || "";
  const macroText = displayVariant?.copy_ready_macro || "";

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-955 transition-colors"
          >
            ← Back to Home
          </Link>
          {user && (
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1 text-[10px] font-bold text-zinc-650 uppercase tracking-wider">
              {user.role} Desk
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Article Header Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border border-zinc-200">
              {article.category?.name || "General"}
            </span>
            <div className="flex items-center gap-2">
              {article.status !== ArticleStatus.Published && (
                <span className="rounded bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-750 border border-yellow-200 uppercase">
                  {article.status}
                </span>
              )}
              <span className="text-xs text-zinc-400 font-medium">
                Last updated {new Date(article.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl text-left">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-100 font-medium justify-start">
            <span>Author: <strong className="text-zinc-800">{article.author?.name || "System"}</strong></span>
            <span>Language: <strong className="text-zinc-800 uppercase">{article.language}</strong></span>
          </div>
        </div>

        {/* Channel Variants Selector Tabs */}
        <div className="flex border-b border-zinc-200 gap-1 overflow-x-auto pb-px">
          <Link
            href={`/articles/${id}?channel=default${token ? `&token=${token}` : ""}`}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeChannel === "default"
                ? "border-zinc-950 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            Customer View
          </Link>
          <Link
            href={`/articles/${id}?channel=chatbot${token ? `&token=${token}` : ""}`}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeChannel === "chatbot"
                ? "border-zinc-950 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            Chatbot Flow
          </Link>
          <Link
            href={`/articles/${id}?channel=whatsapp${token ? `&token=${token}` : ""}`}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeChannel === "whatsapp"
                ? "border-zinc-950 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            WhatsApp Variant
          </Link>
          {showAgentChannel && (
            <Link
              href={`/articles/${id}?channel=agent${token ? `&token=${token}` : ""}`}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                activeChannel === "agent"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-400 hover:text-zinc-650"
              }`}
            >
              Agent Desk 🔒
            </Link>
          )}
        </div>

        {/* Article Body Content */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs space-y-6 text-left">
          {isFallback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 flex items-center gap-2">
              <span>⚠️</span>
              No specific variant found for {activeChannel}. Showing default fallback.
            </div>
          )}

          {shortAnswer && (
            <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 mb-2">Short Summary</h3>
              <p className="text-xs font-medium text-zinc-700 leading-relaxed">{shortAnswer}</p>
            </div>
          )}

          <div className="prose prose-zinc max-w-none text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
            {contentBody}
          </div>

          {activeChannel === "agent" && macroText && (
            <div className="mt-8 border-t border-zinc-100 pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Response Macro</h4>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(macroText);
                    alert("Macro copied to clipboard!");
                  }}
                  className="rounded bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition-all"
                >
                  Copy Macro
                </button>
              </div>
              <pre className="rounded-lg bg-zinc-900 p-4 text-xs font-mono text-zinc-300 overflow-x-auto shadow-inner border border-zinc-850">
                {macroText}
              </pre>
            </div>
          )}
        </div>

        {/* Feedback Section (only for guests/customers) */}
        {!user && <ArticleFeedbackForm articleId={article.id} />}
      </main>
    </div>
  );
}
