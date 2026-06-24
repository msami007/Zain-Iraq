"use client";

import { useState, useEffect, useRef } from "react";
import TroubleshootingPlayer from "@/components/TroubleshootingPlayer";
import { parseMarkdownToHtml } from "@/lib/markdown";
import CustomerSearchWorkspace from "@/components/CustomerSearchWorkspace";
import { useToast } from "@/components/ToastProvider";

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
  tenants: { id: string; name: string; slug: string; branding: any }[];
  initialCategories: { id: string; name: string; slug: string; tenant_id: string }[];
  userRole?: string;
  userName?: string;
};

export default function AgentDeskWorkspace({
  initialCases,
  currentUserId,
  tenantId,
  todaySearches,
  helpfulnessRate,
  tenants,
  initialCategories,
  userRole,
  userName,
}: AgentWorkspaceProps) {
  const toast = useToast();
  const [cases, setCases] = useState<AgentCase[]>(initialCases);
  const [activeTab, setActiveTab] = useState<"waiting" | "active" | "resolved">("waiting");
  const [selectedCase, setSelectedCase] = useState<AgentCase | null>(null);

  // Top level Console Active Tab
  const [agentActiveTab, setAgentActiveTab] = useState<"tickets" | "chat" | "search" | "gaps">("tickets");

  // Search KB states
  const [kbQuery, setKbQuery] = useState("");
  const [kbResults, setKbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [gapLogged, setGapLogged] = useState(false);

  // Search Filters
  const [searchCategory, setSearchCategory] = useState("");
  const [searchLanguage, setSearchLanguage] = useState("en");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");

  // Pinned articles states
  const [pinnedArticleIds, setPinnedArticleIds] = useState<string[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<any[]>([]);
  const [pinnedPreview, setPinnedPreview] = useState<any | null>(null);
  const [loadingPinnedPreview, setLoadingPinnedPreview] = useState(false);

  // Selected article detail state for resolution preview
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  // Workspace tab: kb search vs custom reply vs pinned
  const [workspaceTab, setWorkspaceTab] = useState<"kb" | "reply" | "pinned">("kb");
  const [customReply, setCustomReply] = useState("");
  const [resolvingManually, setResolvingManually] = useState(false);

  // Knowledge Gap Queue tab
  type GapEntry = {
    id: string;
    query_text: string;
    occurrences: number;
    status: string;
    language: string;
    channel: string;
    created_at: string;
    reporter: { name: string } | null;
    claimer: { name: string } | null;
    resolving_article_id: string | null;
    resolving_article: { title: string } | null;
  };
  const [myGaps, setMyGaps] = useState<GapEntry[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapForm, setGapForm] = useState({ query_text: "", language: "en", channel: "default", occurrences: 1 });
  const [submittingGap, setSubmittingGap] = useState(false);

  // Simulated Chat Console states
  const [chatSessions, setChatSessions] = useState([
    {
      id: "chat-1",
      customerName: "Zainab Jaafar",
      avatar: "ZJ",
      status: "active",
      lastMessage: "I cannot login to my Zain app, it says network timeout",
      messages: [
        { sender: "customer", text: "Hello, is anyone there?", time: "14:10" },
        { sender: "customer", text: "I cannot login to my Zain app, it says network timeout", time: "14:11" },
      ]
    },
    {
      id: "chat-2",
      customerName: "Ali Hussein",
      avatar: "AH",
      status: "active",
      lastMessage: "How do I check my Zain Iraq balance?",
      messages: [
        { sender: "customer", text: "Hi, I need help checking my prepaid balance please.", time: "14:15" },
        { sender: "customer", text: "How do I check my Zain Iraq balance?", time: "14:16" },
      ]
    },
    {
      id: "chat-3",
      customerName: "Mariam Abbas",
      avatar: "MA",
      status: "active",
      lastMessage: "I want to activate roaming on my SIM",
      messages: [
        { sender: "customer", text: "I am traveling to Jordan tomorrow.", time: "14:20" },
        { sender: "customer", text: "I want to activate roaming on my SIM", time: "14:21" },
      ]
    }
  ]);
  const [activeChatSessionId, setActiveChatSessionId] = useState("chat-1");
  const [chatInputText, setChatInputText] = useState("");

  // Integrated KB Search inside Chat Console
  const [chatKbQuery, setChatKbQuery] = useState("");
  const [chatKbResults, setChatKbResults] = useState<any[]>([]);
  const [chatPreviewArticle, setChatPreviewArticle] = useState<any | null>(null);
  const [chatSearching, setChatSearching] = useState(false);
  const [chatSearched, setChatSearched] = useState(false);

  const filteredCases = cases.filter((c) => {
    if (activeTab === "waiting") return c.status === "waiting";
    if (activeTab === "active") return c.status === "active" && c.assigned_agent_id === currentUserId;
    return c.status === "resolved";
  });

  // Load pinned articles and fetch all published articles
  useEffect(() => {
    const fetchPublished = async () => {
      try {
        const res = await fetch("/api/v1/articles?status=Published");
        if (res.ok) {
          const data = await res.json();
          setPublishedArticles(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchPublished();

    // Load from local storage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pinned_articles");
      if (saved) {
        try {
          setPinnedArticleIds(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const handleTogglePin = (articleId: string) => {
    const isPinned = pinnedArticleIds.includes(articleId);
    let updated;
    if (isPinned) {
      updated = pinnedArticleIds.filter((id) => id !== articleId);
    } else {
      updated = [...pinnedArticleIds, articleId];
    }
    setPinnedArticleIds(updated);
    localStorage.setItem("pinned_articles", JSON.stringify(updated));
    if (!updated.includes(pinnedPreview?.id)) setPinnedPreview(null);
  };

  const handleOpenPinnedPreview = async (articleId: string) => {
    if (pinnedPreview?.id === articleId) { setPinnedPreview(null); return; }
    setLoadingPinnedPreview(true);
    try {
      const res = await fetch(`/api/v1/articles/${articleId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) setPinnedPreview(await res.json());
    } catch { /* silent */ } finally {
      setLoadingPinnedPreview(false);
    }
  };

  // Generate unique categories dynamically from published articles
  const uniqueCategories = Array.from(
    new Map(
      publishedArticles
        .filter((a) => a.category)
        .map((a) => [a.category.id, a.category])
    ).values()
  );

  // Chat actions
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMessage = { sender: "agent", text: chatInputText.trim(), time: timeStr };

    setChatSessions(chatSessions.map(s => {
      if (s.id === activeChatSessionId) {
        return {
          ...s,
          lastMessage: chatInputText.trim(),
          messages: [...s.messages, newMessage]
        };
      }
      return s;
    }));

    setChatInputText("");

    // Simulate auto customer reply after 1.5 seconds
    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const customerReply = {
        sender: "customer",
        text: `Thanks for the details! I will try that right away.`,
        time: replyTime
      };
      setChatSessions(prev => prev.map(s => {
        if (s.id === activeChatSessionId) {
          return {
            ...s,
            lastMessage: customerReply.text,
            messages: [...s.messages, customerReply]
          };
        }
        return s;
      }));
    }, 1500);
  };

  const handleChatSearchKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatKbQuery.trim()) return;

    setChatSearching(true);
    setChatSearched(true);
    setChatPreviewArticle(null);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          query: chatKbQuery.trim(),
          language: "en",
          channel: "agent",
        }),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setChatKbResults((data.results || []).slice(0, 5));
    } catch (err: any) {
      console.error(err);
    } finally {
      setChatSearching(false);
    }
  };

  const handleChatPreviewArticle = async (articleId: string) => {
    try {
      const res = await fetch(`/api/v1/articles/${articleId}`);
      if (!res.ok) throw new Error("Failed to load article");
      const data = await res.json();
      setChatPreviewArticle(data);

      // Track article view analytics
      fetch("/api/v1/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id: articleId,
          action: "View Article",
          label: data.title,
        })
      }).catch(console.error);
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handlePasteMacro = (macroText: string, articleId: string, articleTitle: string) => {
    setChatInputText(macroText);
    toast("Macro content pasted into text field!", "info");

    // Log macro click analytics
    fetch("/api/v1/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        article_id: articleId,
        action: "Click Macro",
        label: articleTitle,
      })
    }).catch(console.error);
  };

  const refreshCases = async () => {
    try {
      const res = await fetch("/api/v1/cases");
      if (!res.ok) return;
      const fresh: any[] = await res.json();
      setCases(
        fresh.map((c) => ({
          ...c,
          wait_started_at:
            typeof c.wait_started_at === "string"
              ? c.wait_started_at
              : new Date(c.wait_started_at).toISOString(),
          resolved_at: c.resolved_at
            ? typeof c.resolved_at === "string"
              ? c.resolved_at
              : new Date(c.resolved_at).toISOString()
            : null,
        }))
      );
    } catch (e) {
      console.error("Failed to refresh cases:", e);
    }
  };

  const handleClaimCase = async (caseId: string) => {
    setClaimingId(caseId);
    // Optimistic update — row moves to Assigned tab immediately
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? { ...c, status: "active" as const, assigned_agent_id: currentUserId }
          : c
      )
    );
    setActiveTab("active");

    try {
      const res = await fetch("/api/v1/cases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: caseId, claim: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Sync with server truth instead of blindly rolling back
        await refreshCases();
        toast(err.error || "Failed to claim case", "error");
        return;
      }

      const updated = await res.json();
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...updated } : c)));
    } catch (error: any) {
      await refreshCases();
      toast("Network error — could not claim case.", "error");
    } finally {
      setClaimingId(null);
    }
  };

  const loadMyGaps = async () => {
    setGapsLoading(true);
    try {
      const res = await fetch("/api/v1/gaps");
      if (res.ok) setMyGaps(await res.json());
    } finally {
      setGapsLoading(false);
    }
  };

  const handleSubmitGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gapForm.query_text.trim()) return;
    setSubmittingGap(true);
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gapForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Failed to submit gap", "error");
        return;
      }
      toast("Knowledge gap submitted to admin queue!", "success");
      setGapForm({ query_text: "", language: "en", channel: "default", occurrences: 1 });
      await loadMyGaps();
    } catch {
      toast("Network error — could not submit gap.", "error");
    } finally {
      setSubmittingGap(false);
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
          language: searchLanguage,
          channel: "agent",
          filters: {
            category_id: searchCategory || undefined,
            date_start: searchStartDate || undefined,
            date_end: searchEndDate || undefined,
          }
        }),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setKbResults((data.results || []).slice(0, 5));
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

      // Track view article analytics event
      fetch("/api/v1/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id: articleId,
          action: "View Article",
          label: data.title,
        })
      }).catch(console.error);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoadingArticle(false);
    }
  };

  const handleResolveCase = async (caseId: string, articleId: string) => {
    setResolvingCase(true);
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
      toast("Case resolved successfully!", "success");
    } catch (error: any) {
      toast(error.message, "error");
    } finally {
      setResolvingCase(false);
    }
  };

  const handleResolveManually = async (caseId: string) => {
    if (!customReply.trim()) {
      toast("Please write your reply before resolving.", "warning");
      return;
    }
    setResolvingManually(true);
    try {
      const res = await fetch("/api/v1/cases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: caseId,
          status: "resolved",
          resolving_article_id: null,
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
      setCustomReply("");
      setWorkspaceTab("kb");
      toast("Case resolved with your custom reply.", "success");
    } catch (error: any) {
      toast(error.message, "error");
    } finally {
      setResolvingManually(false);
    }
  };

  // Resolution page state
  const [resolutionCase, setResolutionCase] = useState<AgentCase | null>(null);
  const [resolutionArticle, setResolutionArticle] = useState<any | null>(null);
  const [resolutionTopArticles, setResolutionTopArticles] = useState<any[]>([]);
  const [resolutionSearching, setResolutionSearching] = useState(false);
  const [resolvingCase, setResolvingCase] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");

  // One-click gap flag state — tracks the last query flagged so we can show confirmation
  const [gapFlagging, setGapFlagging] = useState(false);
  const [gapFlaggedQuery, setGapFlaggedQuery] = useState<string | null>(null);

  const flagAsGap = async (queryText: string, channel = "agent") => {
    const q = queryText.trim();
    if (!q || gapFlagging) return;
    setGapFlagging(true);
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_text: q, language: "en", channel }),
      });
      if (res.ok) {
        setGapFlaggedQuery(q);
        toast("Flagged as knowledge gap — Admin queue notified.", "success");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to flag gap", "error");
      }
    } catch {
      toast("Network error — could not flag gap.", "error");
    } finally {
      setGapFlagging(false);
    }
  };

  useEffect(() => {
    if (!resolutionCase) {
      setResolutionArticle(null);
      setResolutionTopArticles([]);
      setComposerText("");
      setGapFlaggedQuery(null);
      return;
    }
    const autoSearch = async () => {
      setResolutionSearching(true);
      try {
        const res = await fetch("/api/v1/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({ query: resolutionCase.query_text, language: "en", channel: "agent" }),
        });
        const data = await res.json();
        const topResults = (data.results || []).slice(0, 5);
        if (topResults.length > 0) {
          // Fetch full article details for all top results in parallel
          const articleFetches = topResults.map((r: any) =>
            fetch(`/api/v1/articles/${r.article_id}`, { headers: { "x-tenant-id": tenantId } })
              .then(res => res.ok ? res.json().then(art => ({ ...art, match_score: r.match_score })) : null)
              .catch(() => null)
          );
          const articles = (await Promise.all(articleFetches)).filter(Boolean);
          setResolutionTopArticles(articles);
          if (articles.length > 0) {
            const top = articles[0];
            setResolutionArticle(top);
            const agentVar = top.variants?.find((v: any) => v.channel === "agent");
            const defVar = top.variants?.find((v: any) => v.channel === "default");
            const seed =
              agentVar?.copy_ready_macro ||
              defVar?.copy_ready_macro ||
              agentVar?.short_answer ||
              defVar?.short_answer ||
              "";
            setComposerText(seed);
            return;
          }
        }
        setResolutionTopArticles([]);
        setComposerText(
          `Dear ${resolutionCase.customer_name},\n\nThank you for contacting Zain support regarding: "${resolutionCase.subject}".\n\nWe have reviewed your query and our team is looking into this for you now. We will follow up shortly with a resolution.\n\nBest regards,\nZain Customer Support`
        );
      } catch (e) {
        console.error(e);
      } finally {
        setResolutionSearching(false);
      }
    };
    autoSearch();
  }, [resolutionCase?.id]);

  const TAB_KEYS = ["tickets", "chat", "search", "gaps"] as const;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = TAB_KEYS.indexOf(agentActiveTab);
    const el = tabRefs.current[idx];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [agentActiveTab]);

  return (
    <div className="space-y-6">
      {/* Top Level Console Navigation */}
      <div className="relative flex items-stretch border-b border-zinc-200">
        {(
          [
            {
              key: "tickets",
              label: "Ticket Console",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
                  <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
                </svg>
              ),
            },
            {
              key: "chat",
              label: "Customer Chat",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
            },
            {
              key: "search",
              label: "Knowledge Base",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              ),
            },
            {
              key: "gaps",
              label: "Gap Reports",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/><path d="M12 17h.01"/>
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
              ),
            },
          ] as const
        ).map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            onClick={() => {
              setAgentActiveTab(tab.key as any);
              if (tab.key === "gaps") loadMyGaps();
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
              agentActiveTab === tab.key
                ? "text-zinc-950"
                : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        {/* Sliding indicator */}
        <span
          className="absolute bottom-0 h-0.5 bg-zinc-950 transition-all duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>

      {agentActiveTab === "tickets" && (
        <>
        {resolutionCase ? (
          /* ── RESOLUTION PAGE ── */
          <div className="space-y-5 text-left relative">
            {resolvingCase && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
                <p className="text-xs font-bold text-zinc-600 tracking-wide">Resolving case…</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setResolutionCase(null); setComposerText(""); setResolutionArticle(null); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
              Back to Agent Dashboard
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* ── LEFT: Conversation + Composer + Queue Ops ── */}
              <div className="space-y-4">
                {/* Active Conversation */}
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  {(() => {
                    const waitMins = Math.floor((Date.now() - new Date(resolutionCase.wait_started_at).getTime()) / 60000);
                    const isUrgent = resolutionCase.priority === "high" && waitMins > 5;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Conversation</h3>
                          <span className={`rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent ? "border-red-300 bg-red-50 text-red-600" : "border-zinc-200 bg-zinc-50 text-zinc-500"
                          }`}>
                            {isUrgent ? `Urgent — ${waitMins} min wait` : `${waitMins} min wait`}
                          </span>
                        </div>
                        {(() => {
                          const ctx = resolutionCase.context || {};
                          const contextFields: { label: string; value: string }[] = [
                            { label: "Customer", value: resolutionCase.customer_name },
                            { label: "Channel", value: (ctx.channel || "Zain Web Chat").replace(/-/g, " ") },
                            ...Object.entries(ctx)
                              .filter(([k]) => k !== "channel")
                              .map(([k, v]) => ({
                                label: k.replace(/_/g, " "),
                                value: String(v),
                              })),
                          ];
                          return (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
                              {contextFields.map(({ label, value }) => (
                                <div key={label}>
                                  <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5 capitalize">{label}</span>
                                  <span className="text-xs font-bold text-zinc-950 capitalize">{value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="border-l-4 border-red-400 bg-red-50/40 rounded-r-lg px-4 py-3">
                          <span className="text-[10px] font-bold uppercase text-red-500 block mb-1">Incoming Query</span>
                          <p className="text-xs text-zinc-800 font-medium leading-relaxed">"{resolutionCase.query_text}"</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Response Composer */}
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Response Composer</h3>
                  <textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Loading recommended response..."
                    rows={6}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none transition-all resize-none leading-relaxed"
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (composerText.trim()) {
                          navigator.clipboard.writeText(composerText);
                          toast("Response copied to clipboard!", "success");
                        }
                      }}
                      className="flex items-center gap-1.5 rounded bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Send to Customer
                    </button>
                    <button type="button" onClick={() => setComposerText("")} className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 transition-colors">
                      Clear Composer
                    </button>
                  </div>
                </div>

                {/* Queue Operations */}
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Queue Operations</h3>
                  <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">
                    Take action on this customer's queue status. Resolving or transferring the case will return you to your dashboard.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={resolvingCase}
                      onClick={async () => {
                        await handleResolveCase(resolutionCase.id, resolutionArticle?.id || null);
                        setResolutionCase(null);
                        setComposerText("");
                        setResolutionArticle(null);
                      }}
                      className="flex items-center gap-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white transition-all"
                    >
                      {resolvingCase ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Resolving...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Resolve Case
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-400 cursor-not-allowed" title="CRM integration required — coming in next release">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Transfer Queue (CRM — Coming Soon)
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: AI Recommendation (Top 5) ── */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Top 5 Recommendations</h3>
                  {resolutionTopArticles.length > 0 && (
                    <span className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold text-zinc-500">
                      {resolutionTopArticles.length} article{resolutionTopArticles.length !== 1 ? "s" : ""} found
                    </span>
                  )}
                </div>

                {/* Top-5 article selector */}
                {!resolutionSearching && resolutionTopArticles.length > 1 && (
                  <div className="space-y-1.5 border-b border-zinc-100 pb-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Select Article</p>
                    {resolutionTopArticles.map((art, i) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => {
                          setResolutionArticle(art);
                          const agentVar = art.variants?.find((v: any) => v.channel === "agent");
                          const defVar = art.variants?.find((v: any) => v.channel === "default");
                          const seed = agentVar?.copy_ready_macro || defVar?.copy_ready_macro || agentVar?.short_answer || defVar?.short_answer || "";
                          setComposerText(seed);
                        }}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                          resolutionArticle?.id === art.id
                            ? "border-zinc-900 bg-zinc-950 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold truncate">{i + 1}. {art.title}</span>
                          <span className={`shrink-0 text-[10px] font-bold ${resolutionArticle?.id === art.id ? "text-zinc-400" : "text-zinc-400"}`}>
                            {Math.round(art.match_score * 100)}%
                          </span>
                        </div>
                        {art.category?.name && (
                          <p className={`text-[10px] mt-0.5 ${resolutionArticle?.id === art.id ? "text-zinc-500" : "text-zinc-400"}`}>{art.category.name}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {resolutionSearching ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-zinc-200 border-t-zinc-900" />
                    <p className="text-xs text-zinc-400 font-semibold">Searching knowledge base...</p>
                  </div>
                ) : resolutionArticle ? (
                  <>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Approved Article Title</span>
                      <h4 className="text-base font-extrabold text-zinc-950">{resolutionArticle.title}</h4>
                    </div>

                    {(() => {
                      const agentVar = resolutionArticle.variants?.find((v: any) => v.channel === "agent");
                      const defVar = resolutionArticle.variants?.find((v: any) => v.channel === "default");
                      const shortAnswer = agentVar?.short_answer || defVar?.short_answer || "";
                      const detailedSteps = agentVar?.detailed_steps || defVar?.detailed_steps || "";
                      const steps = detailedSteps
                        .split("\n")
                        .filter((line: string) => /^\s*\d+[\.\)]/.test(line))
                        .map((line: string) => line.replace(/^\s*\d+[\.\)]\s*/, "").trim())
                        .filter(Boolean);
                      const internalNote = detailedSteps.split("\n").find(
                        (l: string) => l.trim() && !/^\s*\d+[\.\)]/.test(l)
                      ) || "";

                      return (
                        <div className="space-y-4">
                          {shortAnswer && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase text-zinc-400">Customer-Facing Response</span>
                                <button
                                  type="button"
                                  onClick={() => setComposerText(shortAnswer)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                  Copy to Response
                                </button>
                              </div>
                              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-700 leading-relaxed">
                                {shortAnswer}
                              </div>
                            </div>
                          )}

                          {internalNote && (
                            <div>
                              <span className="text-[10px] font-bold uppercase text-amber-600 block mb-2">Internal Operational Note (Agents Only)</span>
                              <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-3 text-xs text-zinc-700 leading-relaxed">
                                {internalNote}
                              </div>
                            </div>
                          )}

                          {steps.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-2">Guided Resolution Procedures</span>
                              <ol className="space-y-1.5">
                                {steps.slice(0, 6).map((step: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                                    <span className="shrink-0 font-bold text-zinc-400 mt-0.5">{i + 1}.</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-3 pt-3 border-t border-zinc-100">
                      <a
                        href={`/agent/articles/${resolutionArticle.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 transition-all"
                      >
                        Open Full Article
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleTogglePin(resolutionArticle.id)}
                        className={`flex items-center gap-1.5 rounded border px-4 py-2 text-xs font-bold transition-all ${
                          pinnedArticleIds.includes(resolutionArticle.id)
                            ? "border-zinc-800 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={pinnedArticleIds.includes(resolutionArticle.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                        </svg>
                        {pinnedArticleIds.includes(resolutionArticle.id) ? "Pinned" : "Pin for Later"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-16 text-center space-y-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 mx-auto">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <p className="text-xs text-zinc-400 font-semibold">No matching articles found.</p>
                    <p className="text-[11px] text-zinc-400">Use the Knowledge Base tab to search manually.</p>
                  </div>
                )}

                {/* Differentiated feedback — always shown after search completes */}
                {!resolutionSearching && (
                  <div className="border-t border-zinc-100 pt-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Report a Gap</p>
                    {gapFlaggedQuery === resolutionCase.query_text.trim() ? (
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-green-700">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Gap reported — Admin queue notified
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={gapFlagging}
                          onClick={() => flagAsGap(resolutionCase.query_text, "agent")}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-amber-600 disabled:opacity-50 transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                          </svg>
                          {gapFlagging ? "Flagging…" : "Search Gap — article exists but hard to find (tagging issue)"}
                        </button>
                        {resolutionArticle && (
                          <button
                            type="button"
                            disabled={gapFlagging}
                            onClick={async () => {
                              setGapFlagging(true);
                              try {
                                await fetch("/api/v1/feedback", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ article_id: resolutionArticle.id, helpful: false, comment: `Agent feedback: content issue — "${resolutionCase.query_text}"`, channel: "agent" }),
                                });
                                setGapFlaggedQuery(resolutionCase.query_text.trim());
                                toast("Article content issue reported to content team.", "success");
                              } catch { toast("Could not submit feedback.", "error"); }
                              finally { setGapFlagging(false); }
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="13"/><line x1="12" y1="11" x2="12" y2="15"/>
                            </svg>
                            Article Feedback — content is incorrect or missing
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── TICKET DASHBOARD ── */
          <>
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">My Queue Activity</span>
              <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">
                {cases.filter((c) => c.assigned_agent_id === currentUserId && c.status === "active").length} Active
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Cases assigned to you</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Today's Searches</span>
              <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">{todaySearches} Queries</h3>
              <p className="text-xs text-zinc-400 mt-1 font-medium">KB searches performed today</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Helpfulness Score</span>
              <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">
                {helpfulnessRate !== null ? `${helpfulnessRate}%` : "Pending"}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                {helpfulnessRate !== null ? "Based on customer feedback" : "Pending integration"}
              </p>
            </div>
          </div>

          {/* Main grid: queue table + sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Queue Table */}
            <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white overflow-hidden text-left">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Chat Queue</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {filteredCases.length} Customers in Queue
                </span>
              </div>

              {/* Sub-tabs */}
              <div className="flex border-b border-zinc-100 text-xs">
                {(["waiting", "active", "resolved"] as const).map((tab) => {
                  const count = cases.filter(c =>
                    tab === "waiting" ? c.status === "waiting" :
                    tab === "active" ? c.status === "active" && c.assigned_agent_id === currentUserId :
                    c.status === "resolved"
                  ).length;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setActiveTab(tab); setSelectedCase(null); }}
                      className={`px-5 py-3 font-bold border-b-2 transition-all ${
                        activeTab === tab ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400 hover:text-zinc-700"
                      }`}
                    >
                      {tab === "active" ? "Assigned" : tab === "resolved" ? "Closed" : "Waiting"} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Customer</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject / Query</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Wait Time</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredCases.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400 font-semibold">No cases in this queue.</td>
                      </tr>
                    ) : (
                      filteredCases.map((c) => {
                        const waitMins = Math.floor((Date.now() - new Date(c.wait_started_at).getTime()) / 60000);
                        const isUrgent = c.priority === "high" && waitMins > 5;
                        return (
                          <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-5 py-4">
                              <span className={`text-xs font-bold ${isUrgent ? "text-red-600" : "text-zinc-900"}`}>{c.customer_name}</span>
                            </td>
                            <td className="px-5 py-4 max-w-[200px]">
                              <span className="text-xs text-zinc-600 line-clamp-1">{c.subject}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-xs font-bold ${isUrgent ? "text-red-500" : "text-zinc-500"}`}>{waitMins} min</span>
                            </td>
                            <td className="px-5 py-4">
                              {c.status === "resolved" ? (
                                <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase">Resolved</span>
                              ) : isUrgent ? (
                                <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 uppercase">Urgent Alert</span>
                              ) : c.status === "active" ? (
                                <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">Active</span>
                              ) : (
                                <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-500 uppercase">Waiting</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {c.status === "resolved" ? (
                                <span className="text-[10px] text-zinc-400 font-semibold">Closed</span>
                              ) : c.status === "waiting" ? (
                                <button
                                  type="button"
                                  disabled={claimingId === c.id}
                                  onClick={() => handleClaimCase(c.id)}
                                  className="flex items-center gap-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-950 hover:text-white hover:border-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-1.5 text-xs font-bold text-zinc-700 transition-all"
                                >
                                  {claimingId === c.id ? (
                                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                                  ) : null}
                                  {claimingId === c.id ? "Claiming…" : "Claim Ticket"}
                                </button>
                              ) : c.status === "active" && c.assigned_agent_id === currentUserId ? (
                                <button
                                  type="button"
                                  onClick={() => setResolutionCase(c)}
                                  className={`rounded px-3.5 py-1.5 text-xs font-bold transition-all ${
                                    isUrgent
                                      ? "bg-zinc-950 hover:bg-zinc-800 text-white"
                                      : "border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                                  }`}
                                >
                                  {isUrgent ? "Resolve Case" : "Open"}
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-400 font-semibold italic">Assigned to other</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4 text-left">
              {/* Pinned Resources */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 mb-4">Pinned Resources</h4>
                {pinnedArticleIds.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">No pinned articles yet. Pin articles from the Knowledge Base tab for quick access.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {pinnedArticleIds.map((id) => {
                      const art = publishedArticles.find((a) => a.id === id);
                      return (
                        <a
                          key={id}
                          href={`/articles/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 py-3 group hover:bg-zinc-50 -mx-5 px-5 transition-colors"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-zinc-900 truncate group-hover:text-zinc-600 transition-colors">{art?.title || `Article ${id.slice(0, 8)}`}</h5>
                            {art?.category?.name && <p className="text-[10px] text-zinc-400 mt-0.5">{art.category.name}</p>}
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 group-hover:text-zinc-500 shrink-0 transition-colors">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* end dashboard view */}
          </>
        )}
        </>
      )}


      {/* CUSTOMER CHAT CONSOLE VIEW */}
      {agentActiveTab === "chat" && (
        <div className="flex rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm text-left h-[680px] -mx-2">

          {/* ── Col 1: Conversation list ── */}
          <div className="w-64 shrink-0 flex flex-col border-r border-zinc-100">
            <div className="px-5 py-4 border-b border-zinc-100">
              <p className="text-xs font-extrabold text-zinc-900">Conversations</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{chatSessions.length} active</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatSessions.map((s) => {
                const isActive = activeChatSessionId === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      setActiveChatSessionId(s.id);
                      setChatPreviewArticle(null);
                      setChatKbResults([]);
                      setChatKbQuery("");
                      setChatSearched(false);
                    }}
                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors border-b border-zinc-50 ${
                      isActive ? "bg-zinc-50 border-l-2 border-l-zinc-900" : "hover:bg-zinc-50/60 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-9 w-9 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-700 text-[11px] font-extrabold">
                        {s.avatar}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border-[1.5px] border-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isActive ? "text-zinc-900" : "text-zinc-700"}`}>{s.customerName}</p>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{s.lastMessage}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Col 2: Message stream ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/30">
            {(() => {
              const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
              if (!activeSession) return (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-zinc-500">Select a conversation</p>
                  <p className="text-xs text-zinc-400">Choose from the list on the left to start.</p>
                </div>
              );
              return (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-zinc-100 shrink-0">
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-700 text-[11px] font-extrabold">
                        {activeSession.avatar}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border-[1.5px] border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-zinc-900 leading-none">{activeSession.customerName}</p>
                      <p className="text-[10px] text-green-600 font-semibold mt-0.5">Online</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-zinc-200" />
                      <span className="text-[10px] font-semibold text-zinc-400">Today</span>
                      <div className="flex-1 h-px bg-zinc-200" />
                    </div>
                    {activeSession.messages.map((m, i) => {
                      const isAgent = m.sender === "agent";
                      return (
                        <div key={i} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[68%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                            isAgent
                              ? "bg-zinc-900 text-white rounded-br-sm"
                              : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-sm shadow-sm"
                          }`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <p className={`text-[10px] mt-1.5 text-right ${isAgent ? "text-zinc-500" : "text-zinc-400"}`}>{m.time}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input */}
                  <div className="px-4 py-3 bg-white border-t border-zinc-100 shrink-0">
                    <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type a message…"
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!chatInputText.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-bold text-white transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        Send
                      </button>
                    </form>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── Col 3: KB Assistant ── */}
          <div className="w-[380px] shrink-0 flex flex-col border-l border-zinc-100">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3 shrink-0">
              {chatPreviewArticle ? (
                <>
                  <button
                    type="button"
                    onClick={() => setChatPreviewArticle(null)}
                    className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 19l-7-7 7-7"/>
                    </svg>
                    Back
                  </button>
                  <p className="text-xs font-extrabold text-zinc-900 truncate min-w-0">{chatPreviewArticle.title}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-extrabold text-zinc-900">KB Assistant</p>
                  <p className="text-[10px] text-zinc-400 ml-auto">Find and paste responses</p>
                </>
              )}
            </div>

            {/* Search view */}
            {!chatPreviewArticle && (
              <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-4">
                <form onSubmit={handleChatSearchKB} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search articles…"
                    value={chatKbQuery}
                    onChange={(e) => setChatKbQuery(e.target.value)}
                    className="flex-1 min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={chatSearching}
                    className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 transition-all"
                  >
                    {chatSearching ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    )}
                  </button>
                </form>

                {chatSearched ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Top {chatKbResults.length} result{chatKbResults.length !== 1 ? "s" : ""}</p>
                    {chatKbResults.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 italic py-2">No articles matched.</p>
                    ) : (
                      <div className="space-y-1">
                        {chatKbResults.map((r) => (
                          <button
                            key={r.article_id}
                            type="button"
                            onClick={() => handleChatPreviewArticle(r.article_id)}
                            className="w-full text-left rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 px-3 py-2.5 transition-all"
                          >
                            <p className="text-[11px] font-bold text-zinc-800 truncate">{r.title}</p>
                            {r.category?.name && <p className="text-[10px] text-zinc-400 mt-0.5">{r.category.name}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Differentiated gap flag */}
                    <div className="border-t border-zinc-100 pt-2 space-y-1.5">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Report a Gap</p>
                      {gapFlaggedQuery === chatKbQuery.trim() ? (
                        <p className="flex items-center gap-1 text-[10px] font-bold text-green-700">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Gap reported
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <button
                            type="button"
                            disabled={gapFlagging}
                            onClick={() => flagAsGap(chatKbQuery, "agent")}
                            className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-amber-600 disabled:opacity-50 transition-colors"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                            </svg>
                            Search Gap (tagging issue)
                          </button>
                          {chatPreviewArticle && (
                            <button
                              type="button"
                              disabled={gapFlagging}
                              onClick={async () => {
                                setGapFlagging(true);
                                try {
                                  await fetch("/api/v1/feedback", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ article_id: chatPreviewArticle.id, helpful: false, comment: `Chat KB: content issue — "${chatKbQuery}"`, channel: "agent" }),
                                  });
                                  setGapFlaggedQuery(chatKbQuery.trim());
                                  toast("Article content issue reported.", "success");
                                } catch { toast("Could not submit feedback.", "error"); }
                                finally { setGapFlagging(false); }
                              }}
                              className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                              </svg>
                              Article Feedback (content issue)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-6">
                    <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[180px]">Search the knowledge base to find responses for this conversation.</p>
                  </div>
                )}
              </div>
            )}

            {/* Article detail view — mirrors resolution panel */}
            {chatPreviewArticle && (() => {
              const agentVar = chatPreviewArticle.variants?.find((v: any) => v.channel === "agent");
              const defVar   = chatPreviewArticle.variants?.find((v: any) => v.channel === "default");
              const shortAnswer = agentVar?.short_answer || defVar?.short_answer || "";
              const detailedSteps = agentVar?.detailed_steps || defVar?.detailed_steps || "";
              const macro = agentVar?.copy_ready_macro || defVar?.copy_ready_macro || "";
              const steps = detailedSteps
                .split("\n")
                .filter((l: string) => /^\s*\d+[\.\)]/.test(l))
                .map((l: string) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
                .filter(Boolean);
              const internalNote = detailedSteps
                .split("\n")
                .find((l: string) => l.trim() && !/^\s*\d+[\.\)]/.test(l) && l.trim().length > 20) || "";

              return (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Category + confidence */}
                  <div className="flex items-center justify-between">
                    {chatPreviewArticle.category?.name && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {chatPreviewArticle.category.name}
                      </span>
                    )}
                    {chatPreviewArticle.match_score != null && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600">
                        {Math.round(chatPreviewArticle.match_score * 100)}% match
                      </span>
                    )}
                  </div>

                  {/* Customer-facing response */}
                  {shortAnswer && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Customer-Facing Response</span>
                        <button
                          type="button"
                          onClick={() => { setChatInputText(shortAnswer); toast("Response copied to chat input.", "success"); }}
                          className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          Copy to Chat
                        </button>
                      </div>
                      <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-700 leading-relaxed">
                        {shortAnswer}
                      </div>
                    </div>
                  )}

                  {/* Internal note */}
                  {internalNote && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-600 tracking-widest block mb-2">Internal Note — Agents Only</span>
                      <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3 text-xs text-zinc-700 leading-relaxed">
                        {internalNote}
                      </div>
                    </div>
                  )}

                  {/* Numbered steps */}
                  {steps.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest block mb-2">Resolution Steps</span>
                      <ol className="space-y-1.5">
                        {steps.slice(0, 6).map((step: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                            <span className="shrink-0 font-bold text-zinc-400 mt-0.5">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Macro */}
                  {macro && (
                    <div className="space-y-2 border-t border-zinc-100 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Ready-to-Paste Macro</span>
                        <button
                          type="button"
                          onClick={() => { setChatInputText(macro); toast("Macro pasted to chat input.", "info"); }}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors underline"
                        >
                          Paste Macro
                        </button>
                      </div>
                      <pre className="rounded-lg bg-zinc-900 px-3 py-2.5 font-mono text-[10px] text-zinc-300 overflow-x-auto max-h-[80px] whitespace-pre-wrap">
                        {macro}
                      </pre>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    <a
                      href={`/agent/articles/${chatPreviewArticle.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-[10px] font-bold text-zinc-700 transition-all"
                    >
                      Open Full Article
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(chatPreviewArticle.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all ${
                        pinnedArticleIds.includes(chatPreviewArticle.id)
                          ? "border-zinc-800 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill={pinnedArticleIds.includes(chatPreviewArticle.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                      </svg>
                      {pinnedArticleIds.includes(chatPreviewArticle.id) ? "Pinned" : "Pin"}
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      )}

      {/* STANDALONE KB SEARCH */}
      {agentActiveTab === "search" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <CustomerSearchWorkspace
            tenants={tenants.filter((t) => t.id === tenantId)}
            initialCategories={initialCategories.filter((c) => c.tenant_id === tenantId)}
            isLoggedIn={true}
            userRole={userRole}
            userName={userName}
            hideBrandSelector={true}
            pinnedArticleIds={pinnedArticleIds}
            onTogglePin={handleTogglePin}
          />
        </div>
      )}

      {/* GAP REPORTS TAB */}
      {agentActiveTab === "gaps" && (
        <div className="space-y-5 text-left">

          {/* Two-column layout: form left, tips right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

            {/* Submit form */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100">
                <h3 className="text-sm font-extrabold text-zinc-950">Report a Knowledge Gap</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Flag a query that returned no useful results. It will appear in the Admin review queue immediately.
                </p>
              </div>
              <form onSubmit={handleSubmitGap} className="px-6 py-6 space-y-5">
                {/* Query text */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-xs font-bold text-zinc-700">
                    Search query or topic
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. turkey roaming packages"
                      value={gapForm.query_text}
                      onChange={(e) => setGapForm((f) => ({ ...f, query_text: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 pl-0.5">Enter exactly what the customer typed or the topic that was missing.</p>
                </div>

                {/* Language + Channel + Occurrences in a row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700">Language</label>
                    <select
                      value={gapForm.language}
                      onChange={(e) => setGapForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all appearance-none"
                    >
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700">Reported channel</label>
                    <select
                      value={gapForm.channel}
                      onChange={(e) => setGapForm((f) => ({ ...f, channel: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all appearance-none"
                    >
                      <option value="default">Website / Customer</option>
                      <option value="agent">Agent Portal</option>
                      <option value="chatbot">Chatbot</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700">
                      Occurrences
                      <span className="ml-1 font-normal text-zinc-400">(times searched)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={gapForm.occurrences}
                      onChange={(e) => setGapForm((f) => ({ ...f, occurrences: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all tabular-nums"
                    />
                  </div>
                </div>

                {/* Divider + actions row */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                  <p className="text-[11px] text-zinc-400">
                    If the query already exists it will increment its occurrence count.
                  </p>
                  <button
                    type="submit"
                    disabled={submittingGap || !gapForm.query_text.trim()}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all ml-4"
                  >
                    {submittingGap ? (
                      <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />Submitting…</>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Submit Gap Report
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: info panel */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <span className="text-xs font-extrabold text-amber-900">How this works</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Submit the query the customer couldn't find.",
                    "It enters the Admin knowledge gap queue.",
                    "An admin claims it and creates a KB article.",
                    "You'll see the resolution status in the table below.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[11px] text-amber-800 leading-relaxed">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[9px] font-extrabold text-amber-900 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Status guide</span>
                {[
                  { label: "NEW", color: "bg-red-50 text-red-600 border-red-200", note: "Waiting for admin to pick up" },
                  { label: "IN PROGRESS", color: "bg-amber-50 text-amber-700 border-amber-200", note: "Admin is working on it" },
                  { label: "RESOLVED", color: "bg-green-50 text-green-700 border-green-200", note: "Article created & linked" },
                  { label: "DISMISSED", color: "bg-zinc-100 text-zinc-500 border-zinc-200", note: "Not actionable" },
                ].map(({ label, color, note }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                    <span className="text-[11px] text-zinc-500">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* My submitted gaps table */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-950">My Submitted Gaps</h3>
                  <p className="text-[11px] text-zinc-500">Track the status of your reports.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadMyGaps}
                disabled={gapsLoading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all disabled:opacity-40"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={gapsLoading ? "animate-spin" : ""}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>

            {gapsLoading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />
                <span className="text-xs font-semibold text-zinc-500">Loading…</span>
              </div>
            ) : myGaps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center space-y-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 mb-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-zinc-600">No gaps submitted yet</p>
                <p className="text-xs text-zinc-400 max-w-xs">Use the form above to flag missing knowledge base content — it goes straight to the admin queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/70">
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400 w-[35%]">Search Query</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Hits</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Status</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Channel</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Claimed By</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {myGaps.map((gap) => {
                      const statusConfig: Record<string, { style: string; dot: string }> = {
                        NEW:         { style: "bg-red-50 text-red-600 border-red-200",     dot: "bg-red-400" },
                        IN_PROGRESS: { style: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                        RESOLVED:    { style: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-400" },
                        DISMISSED:   { style: "bg-zinc-100 text-zinc-500 border-zinc-200",  dot: "bg-zinc-400" },
                      };
                      const channelLabels: Record<string, string> = {
                        default: "Website", agent: "Agent Portal", chatbot: "Chatbot", whatsapp: "WhatsApp",
                      };
                      const cfg = statusConfig[gap.status] ?? statusConfig.NEW;
                      return (
                        <tr key={gap.id} className="hover:bg-zinc-50/60 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-zinc-800">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-300 group-hover:text-zinc-400 transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                                </svg>
                              </span>
                              <span className="italic text-zinc-700">&ldquo;{gap.query_text}&rdquo;</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-extrabold text-zinc-700 tabular-nums">
                              {gap.occurrences}×
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.style}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {gap.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-zinc-500 font-medium">{channelLabels[gap.channel] ?? gap.channel}</td>
                          <td className="px-4 py-4">
                            {gap.claimer?.name
                              ? <span className="font-semibold text-zinc-700">{gap.claimer.name}</span>
                              : <span className="text-zinc-400 italic">Unassigned</span>}
                          </td>
                          <td className="px-4 py-4 max-w-[200px]">
                            {gap.resolving_article && gap.resolving_article_id ? (
                              <a
                                href={`/articles/${gap.resolving_article_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-green-700 hover:text-green-900 hover:underline truncate transition-colors"
                              >
                                {gap.resolving_article.title}
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </a>
                            ) : (
                              <span className="text-zinc-400 italic">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PINNED ARTICLES - moved to sidebar, kept as dead code */}
      {false && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: pinned list */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">Pinned Articles</h3>
                <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                  {pinnedArticleIds.length === 0 ? "No articles pinned yet" : `${pinnedArticleIds.length} article${pinnedArticleIds.length !== 1 ? "s" : ""} pinned`}
                </p>
              </div>
              {pinnedArticleIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Unpin all articles?")) {
                      setPinnedArticleIds([]);
                      setPinnedPreview(null);
                      localStorage.removeItem("pinned_articles");
                    }
                  }}
                  className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors"
                >
                  Unpin all
                </button>
              )}
            </div>

            {pinnedArticleIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-zinc-500">No pinned articles</p>
                <p className="text-xs text-zinc-400 font-medium max-w-xs">
                  Search the Knowledge Base and pin frequently used articles for quick access during support calls.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {publishedArticles
                  .filter((a) => pinnedArticleIds.includes(a.id))
                  .map((art) => (
                    <div
                      key={art.id}
                      className={`flex items-start justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors ${
                        pinnedPreview?.id === art.id ? "bg-zinc-50 border-l-2 border-zinc-900" : ""
                      }`}
                      onClick={() => handleOpenPinnedPreview(art.id)}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2">{art.title}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">{art.category?.name || "Uncategorized"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(art.id); }}
                        className="shrink-0 mt-0.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Unpin"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Right: article preview */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden min-h-[200px]">
            {loadingPinnedPreview && (
              <div className="flex items-center justify-center py-16 text-xs text-zinc-400 font-semibold animate-pulse">
                Loading article...
              </div>
            )}

            {!loadingPinnedPreview && !pinnedPreview && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-2">
                <p className="text-sm font-bold text-zinc-400">Select an article to read</p>
                <p className="text-xs text-zinc-400 font-medium">Click any pinned article on the left to preview its content here.</p>
              </div>
            )}

            {!loadingPinnedPreview && pinnedPreview && (() => {
              const variant =
                pinnedPreview.variants?.find((v: any) => v.channel === "agent") ||
                pinnedPreview.variants?.find((v: any) => v.channel === "default");
              return (
                <div>
                  {/* Header */}
                  <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-green-700">
                        {pinnedPreview.status}
                      </span>
                      {pinnedPreview.category && (
                        <span className="text-[10px] text-zinc-400 font-semibold">{pinnedPreview.category.name}</span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-zinc-950 leading-snug">{pinnedPreview.title}</h4>
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                    {!variant ? (
                      <p className="text-xs text-zinc-400 italic">No content available.</p>
                    ) : (
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
                        {variant.copy_ready_macro && (
                          <div className="space-y-2 border-t border-zinc-100 pt-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-zinc-400">Ready-to-Paste Macro</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(variant.copy_ready_macro)}
                                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 underline"
                              >
                                Copy
                              </button>
                            </div>
                            <pre className="rounded bg-zinc-950 p-3 font-mono text-[10px] text-zinc-300 overflow-x-auto max-h-[80px]">
                              {variant.copy_ready_macro}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
