import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import AgentArticleClient from "./AgentArticleClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; categoryId?: string }>;
};

/** Strip HTML tags and all markdown syntax, returning clean plain text. */
function stripMarkdown(raw: string): string {
  return raw
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1") // <a>text</a> → text (keep label)
    .replace(/<[^>]+>/g, "")                  // remaining HTML tags
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ") // HTML entities
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")     // images
    .replace(/#{1,6}\s*/g, "")                // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")        // bold
    .replace(/\*([^*]+)\*/g, "$1")            // italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")       // code
    .replace(/https?:\/\/\S+/g, "")           // bare URLs
    .replace(/[-*+]\s+/g, "")                 // unordered bullets
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Returns true if a line looks like a nav/link dump (more than 1 URL-looking bracket pair). */
function isLinkDump(line: string): boolean {
  const linkCount = (line.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  return linkCount > 1;
}

export default async function AgentArticlePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q: backQuery, categoryId } = await searchParams;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, tenant_id: tenantId } = session.user;
  if (role !== "Agent" && role !== "Admin" && role !== "SuperAdmin") redirect("/login");

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { name: true } },
      variants: true,
      feedback: {
        select: { helpful: true },
        orderBy: { created_at: "desc" },
        take: 200,
      },
    },
  });

  if (!article || article.tenant_id !== tenantId) notFound();

  // Prefer agent variant, fall back to default
  const agentVar = article.variants.find((v) => v.channel === "agent");
  const defaultVar = article.variants.find((v) => v.channel === "default");
  const displayVar = agentVar ?? defaultVar;

  const shortAnswer = stripMarkdown(displayVar?.short_answer ?? "");
  const rawSteps = displayVar?.detailed_steps ?? "";
  const copyMacro = stripMarkdown(displayVar?.copy_ready_macro ?? "") || shortAnswer;

  // Split into raw lines, skip blank lines and nav/link dumps
  const rawLines = rawSteps
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isLinkDump(l));

  // Numbered steps: lines that start with a digit followed by . or )
  const numberedSteps = rawLines
    .filter((l) => /^\d+[\.\)]\s+/.test(l))
    .map((l) => stripMarkdown(l.replace(/^\d+[\.\)]\s+/, "").trim()))
    .filter((l) => l.length > 3);

  // Internal note: non-numbered, non-header prose lines — keep only real sentences (≥ 20 chars after stripping)
  const internalNoteLines = rawLines
    .filter((l) => !/^\d+[\.\)]\s+/.test(l) && !/^#+/.test(l))
    .map((l) => stripMarkdown(l))
    .filter((l) => l.length >= 20);
  // Use only the first meaningful paragraph to avoid dumping the whole body
  const internalNote = internalNoteLines.slice(0, 3).join(" ").trim();

  // Delivery channels — channels that have at least one content field populated
  const channelLabels: Record<string, string> = {
    default: "Website",
    agent: "Agent Portal",
    chatbot: "Chatbot",
    whatsapp: "WhatsApp",
  };
  const deliveryChannels = article.variants
    .filter((v) => v.short_answer || v.detailed_steps || v.copy_ready_macro)
    .map((v) => channelLabels[v.channel] ?? v.channel);

  // Feedback stats
  const totalFeedback = article.feedback.length;
  const helpfulCount = article.feedback.filter((f) => f.helpful).length;
  const helpfulPct = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : null;

  return (
    <AgentArticleClient
      article={{
        id: article.id,
        title: article.title,
        status: article.status,
        language: article.language,
        category: article.category?.name ?? "General",
        categoryId: article.category_id ?? undefined,
        shortAnswer,
        copyMacro,
        numberedSteps,
        internalNote,
        deliveryChannels,
        helpfulPct,
        totalFeedback,
      }}
      backQuery={backQuery}
      backCategoryId={categoryId}
    />
  );
}
