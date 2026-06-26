"use client";

import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
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

type AgentStats = {
  todaySearches: number;
  weeklySearches: number;
  totalSearches: number;
  resolvedCases: number;
  weeklyResolvedCases: number;
  articlesViewed: number;
  weeklyArticlesViewed: number;
  macroClicks: number;
  gapsSubmitted: number;
  gapsResolved: number;
  gapsThisWeek: number;
  todayGaps: number;
  myHelpfulnessRate: number | null;
  myArticlesCount: number;
};

type AgentWorkspaceProps = {
  initialCases: AgentCase[];
  currentUserId: string;
  tenantId: string;
  todaySearches: number;
  helpfulnessRate: number | null;
  agentStats?: AgentStats;
  tenants: { id: string; name: string; slug: string; branding: any }[];
  initialCategories: { id: string; name: string; slug: string; tenant_id: string }[];
  userRole?: string;
  userName?: string;
  userEmail?: string;
  tenantName?: string;
  brandingColor?: string;
  initialQuery?: string;
  initialTab?: "dashboard" | "chat" | "search" | "gaps" | "glossary";
};

export default function AgentDeskWorkspace({
  initialCases,
  currentUserId,
  tenantId,
  todaySearches,
  helpfulnessRate,
  agentStats,
  tenants,
  initialCategories,
  userRole,
  userName,
  userEmail,
  tenantName,
  brandingColor = "#09090B",
  initialQuery,
  initialTab,
}: AgentWorkspaceProps) {
  const toast = useToast();
  const [cases, setCases] = useState<AgentCase[]>(initialCases);
  const [activeTab, setActiveTab] = useState<"waiting" | "active" | "resolved">("waiting");
  const [selectedCase, setSelectedCase] = useState<AgentCase | null>(null);

  const [agentActiveTab, setAgentActiveTab] = useState<"dashboard" | "chat" | "search" | "gaps" | "glossary">(initialTab ?? "dashboard");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryCategory, setGlossaryCategory] = useState("All");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
  const [gapForm, setGapForm] = useState({ query_text: "", language: "en", channel: "default", occurrences: 1, comment: "" });
  const [submittingGap, setSubmittingGap] = useState(false);
  const [myArticles, setMyArticles] = useState<any[]>([]);
  const [myArticlesLoading, setMyArticlesLoading] = useState(false);

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
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>("chat-1");
  const [mobileShowKb, setMobileShowKb] = useState(false);
  const chatSessionMounted = useRef(false);
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
    loadMyArticles();

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
      if (res.ok) {
        const data = await res.json();
        setPinnedPreview(data);
        fetch("/api/v1/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article_id: articleId, action: "View Article", label: data.title }),
        }).catch(() => {});
      }
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

  const handleChatSearchKB = async (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    const query = queryOverride !== undefined ? queryOverride : chatKbQuery;
    if (!query.trim()) return;

    setChatSearching(true);
    setChatSearched(true);
    setChatPreviewArticle(null);
    setShowChatSearchGapForm(false);
    setChatGapFlaggedQuery(null);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          query: query.trim(),
          language: "en",
          channel: "agent",
        }),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const results = (data.results || []).slice(0, 5);
      setChatKbResults(results);
      if (results.length === 0) {
        setShowChatSearchGapForm(true);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setChatSearching(false);
    }
  };

  // Auto-search KB when active chat session changes (skip on initial mount)
  useEffect(() => {
    if (!chatSessionMounted.current) {
      chatSessionMounted.current = true;
      return;
    }
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (session) {
      const customerMsgs = session.messages.filter((m) => m.sender === "customer");
      const queryText = customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1].text : session.lastMessage;
      setChatKbQuery(queryText || "");
      if (queryText && queryText.trim()) {
        handleChatSearchKB(undefined, queryText);
      } else {
        setChatKbResults([]);
        setChatSearched(false);
        setChatPreviewArticle(null);
      }
    }
  }, [activeChatSessionId]);

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

  const loadMyArticles = async () => {
    setMyArticlesLoading(true);
    try {
      const res = await fetch("/api/v1/articles?authored_by_me=true");
      if (res.ok) {
        const data = await res.json();
        setMyArticles(data.articles || data || []);
      }
    } finally {
      setMyArticlesLoading(false);
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
        body: JSON.stringify({ ...gapForm, tenant_id: tenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Failed to submit gap", "error");
        return;
      }
      toast("Knowledge gap submitted to admin queue!", "success");
      setGapForm({ query_text: "", language: "en", channel: "default", occurrences: 1, comment: "" });
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
          tenant_id: tenantId,
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

  // Gap flag state — tracks last flagged query + inline comment inputs
  const [gapFlagging, setGapFlagging] = useState(false);
  const [gapFlaggedQuery, setGapFlaggedQuery] = useState<string | null>(null);
  const [searchGapComment, setSearchGapComment] = useState("");
  const [articleFlagComment, setArticleFlagComment] = useState("");
  const [chatSearchGapComment, setChatSearchGapComment] = useState("");
  const [chatArticleFlagComment, setChatArticleFlagComment] = useState("");
  const [showSearchGapForm, setShowSearchGapForm] = useState(false);
  const [showChatSearchGapForm, setShowChatSearchGapForm] = useState(false);
  const [chatGapFlaggedQuery, setChatGapFlaggedQuery] = useState<string | null>(null);

  const flagAsGap = async (queryText: string, channel = "agent", comment?: string, source = "agent", flagged_article_id?: string) => {
    const q = queryText.trim();
    if (!q || gapFlagging) return;
    setGapFlagging(true);
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_text: q, language: "en", channel, comment: comment || null, source, flagged_article_id: flagged_article_id || null, tenant_id: tenantId }),
      });
      if (res.ok) {
        setGapFlaggedQuery(q);
        setSearchGapComment("");
        setChatSearchGapComment("");
        setShowSearchGapForm(false);
        setShowChatSearchGapForm(false);
        toast("Flagged as knowledge gap — Admin queue notified.", "success");
        loadMyGaps();
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

  const NAV_ITEMS = [
    {
      key: "dashboard" as const,
      label: "Dashboard",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      key: "chat" as const,
      label: "Customer Chat",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      key: "search" as const,
      label: "Knowledge Base",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      ),
    },
    {
      key: "gaps" as const,
      label: "Gap Reports",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M12 9v4"/><path d="M12 17h.01"/>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      ),
    },
    {
      key: "glossary" as const,
      label: "Glossary",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
        </svg>
      ),
    },
  ];

  const sectionTitle: Record<string, string> = {
    dashboard: "Dashboard",
    chat: "Customer Chat",
    search: "Knowledge Base",
    gaps: "Gap Reports",
    glossary: "Glossary",
  };

  const rejectedCount = myArticles.filter((a: any) => a.status === "Rejected").length;

  return (
    <div className="min-h-screen flex bg-zinc-50 w-full text-left relative">
      <style>{`
  @keyframes tabFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tab-fade-in { animation: tabFadeIn 0.18s ease both; }
`}</style>

      {/* Sidebar Backdrop for Mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`w-56 flex-shrink-0 bg-[#0c0c14] border-r border-white/[0.06] flex flex-col justify-between fixed inset-y-0 left-0 z-50 transform md:sticky md:translate-x-0 transition-transform duration-300 ease-in-out h-screen shadow-[4px_0_24px_rgba(0,0,0,0.35)] ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <img src="/images/zain-logo.png" alt="Zain Iraq" className="h-8 w-auto object-contain flex-shrink-0 brightness-0 invert" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-3 pt-5 space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 px-3 mb-2">Workspace</p>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setAgentActiveTab(item.key as any);
                  if (item.key === "gaps") { loadMyGaps(); loadMyArticles(); }
                  setMobileSidebarOpen(false);
                }}
                className={`relative group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200 text-left ${
                  agentActiveTab === item.key
                    ? "bg-white/[0.1] text-white"
                    : "text-white/45 hover:text-white/80 hover:bg-white/[0.06]"
                }`}
              >
                <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-amber-400/70 transition-all duration-200 origin-center ${
                  agentActiveTab === item.key ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                }`} />
                <span className={`flex-shrink-0 transition-all duration-200 group-hover:scale-110 ${agentActiveTab === item.key ? "text-amber-400/80" : ""}`}>
                  {item.icon}
                </span>
                {item.label}
                {item.key === "gaps" && rejectedCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/20">
                    {rejectedCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* User Footer */}
        <div className="px-3 pt-4 pb-4 border-t border-white/[0.06] space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-indigo-300">{userName?.[0]?.toUpperCase() ?? "A"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-white truncate leading-none mb-0.5">{userName}</div>
              <div className="text-[10px] font-mono text-white/35 truncate">{userEmail}</div>
            </div>
          </div>
          <div className="px-1">
            <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-amber-400/[0.08] border border-amber-400/[0.15] text-amber-400/70">
              <span className="h-1 w-1 rounded-full bg-amber-400/70" />
              {userRole}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}
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

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50">

        {/* Header Bar */}
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
            <h2 className="text-sm font-extrabold text-zinc-955 uppercase tracking-wide">
              {sectionTitle[agentActiveTab]}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-[10px] font-bold text-green-700 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Shift Active
            </span>
            <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-650">
              {todaySearches} searches today
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <div key={agentActiveTab} className="flex-1 overflow-y-auto p-8 space-y-6 tab-fade-in">

      {agentActiveTab === "dashboard" && (
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
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Gap reported — Admin queue notified
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Search Gap — with mandatory comment */}
                        {showSearchGapForm ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                            <p className="text-[10px] font-bold text-amber-700">Search Gap — article exists but hard to find (tagging issue)</p>
                            <textarea
                              value={searchGapComment}
                              onChange={e => setSearchGapComment(e.target.value)}
                              placeholder="What were you looking for? What search terms did you try? (required)"
                              rows={2}
                              className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={gapFlagging || !searchGapComment.trim()}
                                onClick={() => flagAsGap(resolutionCase.query_text, "agent", searchGapComment, "agent")}
                                className="rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-1 text-[10px] font-bold text-white"
                              >
                                {gapFlagging ? "Reporting…" : "Submit Gap"}
                              </button>
                              <button type="button" onClick={() => setShowSearchGapForm(false)} className="text-[10px] text-zinc-400 hover:text-zinc-700">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowSearchGapForm(true)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-amber-600 transition-colors text-left"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            Search Gap — article exists but hard to find (tagging issue)
                          </button>
                        )}

                        {/* Article Missing Info — routed through gaps pipeline */}
                        {resolutionArticle && (
                          <div className="rounded-lg border border-red-100 bg-red-50/40 p-3 space-y-2">
                            <p className="text-[10px] font-bold text-red-700">Flag Article as Missing Information</p>
                            <textarea
                              value={articleFlagComment}
                              onChange={e => setArticleFlagComment(e.target.value)}
                              placeholder="What information is missing or incorrect? (required)"
                              rows={2}
                              className="w-full rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={gapFlagging || !articleFlagComment.trim()}
                              onClick={async () => {
                                await flagAsGap(
                                  resolutionCase.query_text,
                                  "agent",
                                  articleFlagComment,
                                  "article_flag",
                                  resolutionArticle.id
                                );
                                setArticleFlagComment("");
                              }}
                              className="rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1 text-[10px] font-bold text-white"
                            >
                              {gapFlagging ? "Flagging…" : "Flag Article"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── DASHBOARD ── */
          <>
          {/* ── Analytics KPI row ── */}
          {agentStats && (() => {
            const s = agentStats;
            const kpiCards = [
              {
                label: "Queries Handled",
                value: s.todaySearches,
                sub: "Today",
                delta: `+${s.weeklySearches} KB searches this week`,
                deltaUp: true as boolean | null,
                accentFrom: "#2563eb",
                accentTo: "#60a5fa",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                ),
              },
              {
                label: "Cases Resolved",
                value: s.resolvedCases,
                sub: "All time",
                delta: `+${s.weeklyResolvedCases} cases closed this week`,
                deltaUp: true as boolean | null,
                accentFrom: "#059669",
                accentTo: "#34d399",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                label: "Articles Opened",
                value: s.articlesViewed,
                sub: "All time",
                delta: `+${s.weeklyArticlesViewed} articles read this week`,
                deltaUp: true as boolean | null,
                accentFrom: "#4f46e5",
                accentTo: "#818cf8",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                ),
              },
              {
                label: "Helpful Rate",
                value: helpfulnessRate !== null ? `${helpfulnessRate}%` : "—",
                sub: helpfulnessRate !== null ? "Based on KB feedback" : "No feedback yet",
                delta: helpfulnessRate !== null
                  ? helpfulnessRate >= 70 ? "Good rating" : helpfulnessRate >= 40 ? "Average rating" : "Needs improvement"
                  : null as string | null,
                deltaUp: helpfulnessRate !== null
                  ? helpfulnessRate >= 70 ? true : helpfulnessRate >= 40 ? null : false
                  : null as boolean | null,
                accentFrom: helpfulnessRate !== null && helpfulnessRate >= 70
                  ? "#059669"
                  : helpfulnessRate !== null && helpfulnessRate >= 40
                  ? "#d97706"
                  : "#7c3aed",
                accentTo: helpfulnessRate !== null && helpfulnessRate >= 70
                  ? "#34d399"
                  : helpfulnessRate !== null && helpfulnessRate >= 40
                  ? "#fbbf24"
                  : "#a78bfa",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                ),
              },
            ];
            return (
              <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                  <div key={card.label} className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow text-left overflow-hidden flex flex-col justify-between h-[120px]">
                    <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${card.accentFrom}, ${card.accentTo})` }} />
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{card.label}</span>
                      <span style={{ color: card.accentFrom }}>{card.icon}</span>
                    </div>
                    <div className="text-[2rem] font-extrabold text-zinc-950 leading-none tabular-nums mt-1">{card.value}</div>
                    {card.delta && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${card.deltaUp === true ? "text-green-600" : card.deltaUp === false ? "text-red-500" : "text-zinc-400"}`}>
                        {card.deltaUp === true && <span>▲</span>}
                        {card.deltaUp === false && <span>▼</span>}
                        {card.delta}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Second row: gaps + weekly */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Knowledge Gaps */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Knowledge Gaps</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <path d="M12 9v4"/><path d="M12 17h.01"/>
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    </svg>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "This week", val: s.gapsThisWeek, dot: "bg-amber-400", cls: "text-amber-700" },
                      { label: "Today", val: s.todayGaps, dot: "bg-red-400", cls: "text-red-600" },
                      { label: "Resolved", val: s.gapsResolved, dot: "bg-green-400", cls: "text-green-700" },
                      { label: "Pending", val: s.gapsSubmitted - s.gapsResolved, dot: "bg-zinc-300", cls: "text-zinc-700" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${row.dot}`} />
                          <span className="text-xs font-semibold text-zinc-500">{row.label}</span>
                        </div>
                        <span className={`text-sm font-extrabold tabular-nums ${row.cls}`}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100">
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: s.gapsSubmitted > 0 ? `${Math.min(100, Math.round((s.gapsResolved / s.gapsSubmitted) * 100))}%` : "0%" }} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-zinc-400">{s.gapsResolved} of {s.gapsSubmitted} resolved ({s.gapsSubmitted > 0 ? Math.round((s.gapsResolved / s.gapsSubmitted) * 100) : 0}%)</p>
                  </div>
                </div>

                {/* This Week */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 block mb-4">This Week Summary</span>
                  <div className="space-y-3">
                    {[
                      { label: "Search queries", value: s.weeklySearches },
                      { label: "Cases resolved", value: s.weeklyResolvedCases },
                      { label: "Articles opened", value: s.weeklyArticlesViewed },
                    ].map((row) => {
                      const max = Math.max(s.weeklySearches, s.weeklyResolvedCases, s.weeklyArticlesViewed, 1);
                      return (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-zinc-600 w-28 shrink-0">{row.label}</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="h-1 rounded-full bg-zinc-100 flex-1 overflow-hidden">
                              <div className="h-full rounded-full bg-zinc-400" style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-extrabold text-zinc-950 tabular-nums w-6 text-right shrink-0">{row.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100">
                    <p className="text-[10px] text-zinc-400">{s.totalSearches} total queries · {s.resolvedCases} total cases closed</p>
                  </div>
                </div>
              </div>
              </>
            );
          })()}

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
                        <td colSpan={5} className="px-5 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                              </svg>
                              <p className="text-xs font-bold text-zinc-500">No cases in this queue</p>
                              <p className="text-[11px] text-zinc-400">New inbound cases will appear here automatically.</p>
                            </div>
                          </td>
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
      {agentActiveTab === "chat" && (() => {
        const avatarColors = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-rose-500","bg-amber-500","bg-cyan-500"];
        const sessionColor = (id: string) => avatarColors[id.charCodeAt(id.length - 1) % avatarColors.length];
        return (
        <div className="flex rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm text-left -mx-2" style={{ height: "calc(100vh - 9rem)" }}>

          {/* ── Col 1: Conversation list ── */}
          <div className={`w-full lg:w-72 shrink-0 flex flex-col border-r border-zinc-100 bg-zinc-50/40 ${
            activeChatSessionId !== null ? "hidden lg:flex" : "flex"
          }`}>
            {/* Sidebar header */}
            <div className="px-5 py-4 border-b border-zinc-100 bg-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-zinc-900">Conversations</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{chatSessions.length} active</p>
                </div>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-white text-[9px] font-extrabold">
                  {chatSessions.length}
                </span>
              </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {chatSessions.map((s) => {
                const isActive = activeChatSessionId === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => { setActiveChatSessionId(s.id); setChatPreviewArticle(null); }}
                    className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl transition-all mb-1 ${
                      isActive
                        ? "bg-white shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-zinc-200"
                        : "hover:bg-white/80 border border-transparent"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`h-10 w-10 rounded-full ${sessionColor(s.id)} flex items-center justify-center text-white text-xs font-extrabold shadow-sm`}>
                        {s.avatar}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs font-bold truncate ${isActive ? "text-zinc-900" : "text-zinc-600"}`}>{s.customerName}</p>
                        <span className="text-[9px] text-zinc-400 shrink-0 font-medium">{s.messages[s.messages.length - 1]?.time ?? ""}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate leading-relaxed">{s.lastMessage}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Col 2: Message stream ── */}
          <div className={`flex-1 flex flex-col min-w-0 bg-[#f8f8fb] ${
            activeChatSessionId === null ? "hidden lg:flex" : (mobileShowKb ? "hidden lg:flex" : "flex")
          }`}>
            {(() => {
              const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
              if (!activeSession) return (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="h-14 w-14 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-zinc-600">Select a conversation</p>
                  <p className="text-xs text-zinc-400">Choose from the list on the left to start.</p>
                </div>
              );

              const acColor = sessionColor(activeSession.id);
              return (
                <>
                  {/* Chat header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-zinc-200 shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    {/* Back to list button on mobile */}
                    <button
                      type="button"
                      onClick={() => setActiveChatSessionId(null)}
                      className="lg:hidden p-1.5 -ml-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                    </button>

                    <div className="relative shrink-0">
                      <div className={`h-9 w-9 rounded-full ${acColor} flex items-center justify-center text-white text-[11px] font-extrabold`}>
                        {activeSession.avatar}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-zinc-900 leading-none">{activeSession.customerName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                        <p className="text-[10px] text-green-600 font-semibold">Online</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* KB Toggle on Mobile */}
                      <button
                        type="button"
                        onClick={() => setMobileShowKb(true)}
                        className="lg:hidden flex items-center gap-1 rounded-full bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-white transition-colors shadow-xs"
                      >
                        🔍 Search KB
                      </button>
                      <span className="hidden sm:inline-block rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-500">Live Chat</span>
                      <span className="hidden sm:inline-block rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-600">Assigned to you</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-zinc-200/70" />
                      <span className="text-[10px] font-semibold text-zinc-400 bg-[#f8f8fb] px-2">Today</span>
                      <div className="flex-1 h-px bg-zinc-200/70" />
                    </div>
                    {activeSession.messages.map((m, i) => {
                      const isAgent = m.sender === "agent";
                      return (
                        <div key={i} className={`flex items-end gap-2.5 ${isAgent ? "justify-end" : "justify-start"}`}>
                          {!isAgent && (
                            <div className={`h-7 w-7 rounded-full ${acColor} flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 mb-0.5`}>
                              {activeSession.avatar}
                            </div>
                          )}
                          <div className={`max-w-[65%] ${isAgent ? "items-end" : "items-start"} flex flex-col gap-1`}>
                            <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                              isAgent
                                ? "bg-zinc-900 text-white rounded-br-sm"
                                : "bg-white text-zinc-800 border border-zinc-200/80 rounded-bl-sm"
                            }`}>
                              <p className="whitespace-pre-wrap">{m.text}</p>
                            </div>
                            <p className={`text-[9px] font-medium px-1 ${isAgent ? "text-right text-zinc-400" : "text-zinc-400"}`}>{m.time}</p>
                          </div>
                          {isAgent && (
                            <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 mb-0.5">
                              {(userName || "A").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Input bar */}
                  <div className="px-5 py-4 bg-white border-t border-zinc-200 shrink-0">
                    <form onSubmit={handleSendChatMessage} className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 focus-within:border-zinc-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/5 transition-all">
                        <input
                          type="text"
                          placeholder="Type a message…"
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                          className="flex-1 bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!chatInputText.trim()}
                        className="flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-bold text-white transition-all shadow-sm"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          <div className={`w-full lg:w-[420px] shrink-0 flex flex-col border-l border-zinc-200 bg-white ${
            mobileShowKb ? "flex" : "hidden lg:flex"
          }`}>

            {/* KB panel header */}
            <div className="px-5 py-3.5 border-b border-zinc-100 shrink-0 bg-white">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Back to Chat button on mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileShowKb(false)}
                    className="lg:hidden flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors shrink-0 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 19l-7-7 7-7"/>
                    </svg>
                    Chat
                  </button>

                  {chatPreviewArticle ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setChatPreviewArticle(null)}
                        className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors shrink-0 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                      </button>
                      <p className="text-xs font-extrabold text-zinc-900 truncate">{chatPreviewArticle.title}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <div className="h-6 w-6 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                      </div>
                      <p className="text-xs font-extrabold text-zinc-900 truncate">KB Assistant</p>
                    </div>
                  )}
                </div>
                {!chatPreviewArticle && (
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">Find responses</span>
                )}
              </div>
            </div>

            {/* Search view */}
            {!chatPreviewArticle && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Search bar */}
                <div className="p-4 border-b border-zinc-100">
                  <form onSubmit={handleChatSearchKB} className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 focus-within:border-zinc-400 focus-within:bg-white transition-all">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search articles…"
                        value={chatKbQuery}
                        onChange={(e) => setChatKbQuery(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={chatSearching}
                      className="shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {chatSearching ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" />
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      )}
                    </button>
                  </form>
                </div>

                {chatSearched ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Results */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                        {chatKbResults.length} result{chatKbResults.length !== 1 ? "s" : ""}
                      </p>
                      {chatKbResults.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center">
                          <p className="text-xs text-zinc-400">No articles matched.</p>
                          <p className="text-[10px] text-zinc-300 mt-1">Try different keywords.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {chatKbResults.map((r, idx) => (
                            <button
                              key={r.article_id}
                              type="button"
                              onClick={() => handleChatPreviewArticle(r.article_id)}
                              className="w-full text-left rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-sm px-4 py-3 transition-all group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-zinc-800 group-hover:text-zinc-900 leading-snug">{r.title}</p>
                                {r.match_score != null && (
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                                    r.match_score >= 0.7 ? "bg-green-100 text-green-700" : r.match_score >= 0.4 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"
                                  }`}>
                                    {Math.round(r.match_score * 100)}%
                                  </span>
                                )}
                              </div>
                              {r.category?.name && (
                                <span className="mt-1.5 inline-block text-[9px] font-bold uppercase tracking-wide text-zinc-400">{r.category.name}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gap report section */}
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
                        <div className="h-6 w-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <path d="M12 9v4"/><path d="M12 17h.01"/>
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-zinc-800">Report a Gap</p>
                          <p className="text-[10px] text-zinc-400">Flag missing or inaccurate KB content</p>
                        </div>
                        {chatGapFlaggedQuery === chatKbQuery.trim() && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 shrink-0">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Reported
                          </span>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        {chatGapFlaggedQuery === chatKbQuery.trim() ? (
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-zinc-500">Gap has been submitted to the admin queue.</p>
                            <button
                              type="button"
                              onClick={() => { setChatGapFlaggedQuery(null); setShowChatSearchGapForm(false); setChatSearchGapComment(""); }}
                              className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 underline transition-colors shrink-0 ml-2"
                            >Report again</button>
                          </div>
                        ) : showChatSearchGapForm ? (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">Query flagged</label>
                              <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-[10px] text-zinc-600 font-mono truncate">
                                "{chatKbQuery}"
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">What's missing?</label>
                              <textarea
                                value={chatSearchGapComment}
                                onChange={e => setChatSearchGapComment(e.target.value)}
                                placeholder="Describe what info was missing or what the correct answer should be…"
                                rows={3}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[10px] text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={gapFlagging || !chatSearchGapComment.trim()}
                                onClick={async () => {
                                  await flagAsGap(chatKbQuery, "agent", chatSearchGapComment, "agent");
                                  setChatGapFlaggedQuery(chatKbQuery.trim());
                                  setShowChatSearchGapForm(false);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-[10px] font-bold text-white transition-colors"
                              >
                                {gapFlagging ? (
                                  <><span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" /> Submitting…</>
                                ) : (
                                  <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Gap Report</>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowChatSearchGapForm(false); setChatSearchGapComment(""); }}
                                className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-2 text-[10px] font-bold text-zinc-500 transition-colors"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowChatSearchGapForm(true)}
                            className="w-full flex items-center gap-3 rounded-lg border border-dashed border-amber-200 bg-white hover:bg-amber-50/40 hover:border-amber-300 px-3 py-3 text-left transition-all group"
                          >
                            <div className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-100 group-hover:bg-amber-100 flex items-center justify-center shrink-0 transition-colors">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-zinc-700 group-hover:text-amber-700 transition-colors">Search gap</p>
                              <p className="text-[9px] text-zinc-400 mt-0.5">Results don't answer the query</p>
                            </div>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 group-hover:text-amber-400 ml-auto shrink-0 transition-colors">
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-8">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 mb-1">Search the Knowledge Base</p>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">Find articles and paste responses directly into the chat.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Article detail view */}
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
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {chatPreviewArticle.category?.name && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {chatPreviewArticle.category.name}
                      </span>
                    )}
                    {chatPreviewArticle.match_score != null && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        chatPreviewArticle.match_score >= 0.7 ? "bg-green-100 text-green-700" : chatPreviewArticle.match_score >= 0.4 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"
                      }`}>
                        {Math.round(chatPreviewArticle.match_score * 100)}% match
                      </span>
                    )}
                  </div>

                  {/* Customer-facing response */}
                  {shortAnswer && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Customer Response</span>
                        <button
                          type="button"
                          onClick={() => { setChatInputText(shortAnswer); toast("Response copied to chat input.", "success"); }}
                          className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-2 py-1 transition-all"
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          Copy to Chat
                        </button>
                      </div>
                      <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3 text-xs text-zinc-700 leading-relaxed">
                        {shortAnswer}
                      </div>
                    </div>
                  )}

                  {/* Internal note */}
                  {internalNote && (
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-widest block mb-2">Agent Note</span>
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-zinc-700 leading-relaxed">
                        {internalNote}
                      </div>
                    </div>
                  )}

                  {/* Numbered steps */}
                  {steps.length > 0 && (
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest block mb-2">Resolution Steps</span>
                      <ol className="space-y-2">
                        {steps.slice(0, 6).map((step: string, i: number) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-700">
                            <span className="shrink-0 h-5 w-5 rounded-full bg-zinc-100 flex items-center justify-center text-[9px] font-extrabold text-zinc-500 mt-0.5">{i + 1}</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Macro */}
                  {macro && (
                    <div className="space-y-2 border-t border-zinc-100 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Ready-to-Paste Macro</span>
                        <button
                          type="button"
                          onClick={() => { setChatInputText(macro); toast("Macro pasted to chat input.", "info"); }}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-2 py-1 transition-all"
                        >
                          Paste Macro
                        </button>
                      </div>
                      <pre className="rounded-xl bg-zinc-900 px-3 py-2.5 font-mono text-[10px] text-zinc-300 overflow-x-auto max-h-[80px] whitespace-pre-wrap">
                        {macro}
                      </pre>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                    <a
                      href={`/agent/articles/${chatPreviewArticle.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-[10px] font-bold text-zinc-700 transition-all"
                    >
                      Open Full Article
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(chatPreviewArticle.id)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold transition-all ${
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

                  {/* Article flag */}
                  {chatPreviewArticle && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
                        <div className="h-6 w-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-zinc-800">Flag This Article</p>
                          <p className="text-[10px] text-zinc-400">Report inaccurate or missing info</p>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <textarea
                          value={chatArticleFlagComment}
                          onChange={e => setChatArticleFlagComment(e.target.value)}
                          placeholder="Describe what's missing or incorrect in this article…"
                          rows={3}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[10px] text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-400/10 transition-all"
                        />
                        <button
                          type="button"
                          disabled={gapFlagging || !chatArticleFlagComment.trim()}
                          onClick={async () => {
                            await flagAsGap(chatKbQuery, "agent", chatArticleFlagComment, "article_flag", chatPreviewArticle.id);
                            setChatArticleFlagComment("");
                            setChatGapFlaggedQuery(chatKbQuery.trim());
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-[10px] font-bold text-white transition-colors"
                        >
                          {gapFlagging ? (
                            <><span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" /> Flagging…</>
                          ) : (
                            <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg> Submit Flag</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

        </div>
        );
      })()}

      {/* STANDALONE KB SEARCH */}
      {agentActiveTab === "search" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-extrabold text-zinc-950">Knowledge Base</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Search published articles to assist customers</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-50 border border-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700">
                {pinnedArticleIds.length} pinned
              </span>
            </div>
          </div>
          <CustomerSearchWorkspace
            tenants={tenants.filter((t) => t.id === tenantId)}
            initialCategories={initialCategories.filter((c) => c.tenant_id === tenantId)}
            isLoggedIn={true}
            userRole={userRole}
            userName={userName}
            hideBrandSelector={true}
            pinnedArticleIds={pinnedArticleIds}
            onTogglePin={handleTogglePin}
            feedbackSource="agent"
            feedbackChannel="agent"
            feedbackPlaceholder="Describe what Zain information is missing or what the customer was looking for…"
            feedbackTitle="Report Knowledge Gap"
            feedbackSubtitle="Describe the missing information so the admin team can create a resolving article."
            agentMode={true}
            initialQuery={initialQuery}
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

                {/* Feedback / comment */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700">
                    Feedback / Context
                    <span className="ml-1 font-normal text-zinc-400">(recommended)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What were you looking for? What info was missing? Helps admins understand the gap."
                    value={gapForm.comment}
                    onChange={(e) => setGapForm((f) => ({ ...f, comment: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all resize-none"
                  />
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
                  { label: "NEW", color: "bg-blue-50 text-blue-700 border-blue-200", note: "Waiting for admin to pick up" },
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
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
              <div
                style={{ maxHeight: myGaps.length > 5 ? "340px" : undefined, overflowY: myGaps.length > 5 ? "auto" : undefined }}
                className="overflow-x-auto [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-300"
              >
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400 w-[28%]">Search Query</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400 w-[25%]">Your Feedback</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Hits</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Status</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Claimed By</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {myGaps.map((gap) => {
                      const statusConfig: Record<string, { style: string; dot: string }> = {
                        NEW:         { style: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-400" },
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
                          <td className="px-4 py-4 max-w-[180px]">
                            {(gap as any).comment ? (
                              <p className="text-[10px] text-zinc-600 italic leading-relaxed line-clamp-2">"{(gap as any).comment}"</p>
                            ) : (
                              <span className="text-[10px] text-zinc-300">—</span>
                            )}
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

          {/* My Articles — rejection notifications (item 12) */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">My Articles</h3>
                <p className="text-[11px] text-zinc-500">Review status changes and rejection feedback on articles you authored.</p>
              </div>
              <button type="button" onClick={loadMyArticles} disabled={myArticlesLoading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all disabled:opacity-40">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={myArticlesLoading ? "animate-spin" : ""}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>
            {myArticlesLoading ? (
              <div className="flex items-center justify-center py-10 gap-3">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />
                <span className="text-xs font-semibold text-zinc-500">Loading…</span>
              </div>
            ) : myArticles.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-zinc-400">No authored articles yet</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {myArticles.map((art: any) => {
                  const rejections = (art.status_history || []).filter((h: any) => h.to_status === "Rejected" && h.comment);
                  const isRejected = art.status === "Rejected";
                  const statusColors: Record<string, string> = {
                    Published: "bg-green-50 text-green-700 border-green-200",
                    Draft: "bg-zinc-100 text-zinc-500 border-zinc-200",
                    InReview: "bg-blue-50 text-blue-700 border-blue-200",
                    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    Archived: "bg-zinc-200 text-zinc-600 border-zinc-300",
                    Rejected: "bg-red-50 text-red-700 border-red-200",
                  };
                  return (
                    <div key={art.id} className={`px-6 py-4 space-y-2 ${isRejected ? "bg-red-50/30" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 leading-snug truncate">{art.title}</p>
                          <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{art.category?.name} · {new Date(art.updated_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${statusColors[art.status] || "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
                          {art.status}
                        </span>
                      </div>
                      {rejections.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
                          <p className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">Rejection Feedback</p>
                          {rejections.map((r: any, i: number) => (
                            <div key={i} className="text-[11px] text-red-800 leading-relaxed">
                              <span className="font-semibold">{r.actor?.name || "Reviewer"}</span>
                              <span className="text-red-600 mx-1">·</span>
                              <span className="text-[10px] text-red-400">{new Date(r.created_at).toLocaleDateString()}</span>
                              <p className="mt-0.5 italic">"{r.comment}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {art.status === "Draft" && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/v1/articles/${art.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "InReview" }),
                              });
                              if (res.ok) { toast("Article submitted for review.", "success"); loadMyArticles(); }
                              else { const e = await res.json(); toast(e.error || "Failed to submit article.", "error"); }
                            }}
                            className="rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700 transition-all"
                          >
                            Submit for Review
                          </button>
                        </div>
                      )}
                      {isRejected && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/v1/articles/${art.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "Draft" }),
                              });
                              if (res.ok) { toast("Article moved back to Draft for revision.", "success"); loadMyArticles(); }
                              else toast("Failed to update article status.", "error");
                            }}
                            className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1 text-[10px] font-bold text-zinc-700 transition-all"
                          >
                            Revise (Back to Draft)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/v1/articles/${art.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "InReview" }),
                              });
                              if (res.ok) { toast("Article resubmitted for review.", "success"); loadMyArticles(); }
                              else toast("Failed to resubmit article.", "error");
                            }}
                            className="rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700 transition-all"
                          >
                            Resubmit for Review
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GLOSSARY TAB */}
      {agentActiveTab === "glossary" && (() => {
        const sections = [
          {
            category: "Knowledge Base & Search",
            badgeClass: "bg-blue-50 border-blue-100 text-blue-700",
            barClass: "bg-blue-500",
            borderClass: "border-l-blue-300",
            items: [
              { term: "Match % / Confidence", def: "How closely an article answers a search query, scored by AI from 0–100%. Above 70% is a strong match; below 40% means it is loosely related and may not fully help the customer." },
              { term: "Published Article", def: "An article that is live and approved for use. Only published articles appear in KB search results." },
              { term: "Pinned Article", def: "An article saved for quick access during customer interactions. Pinned articles appear in the KB sidebar for fast retrieval." },
              { term: "Browse by Category", def: "Explore the KB by topic area (e.g. Postpaid, Roaming, Billing) without typing a query — useful when you are unsure what to search for." },
              { term: "Language filter", def: "Filter search results by article language (EN/AR). Useful when assisting Arabic-speaking customers." },
            ],
          },
          {
            category: "Performance Metrics",
            badgeClass: "bg-violet-50 border-violet-100 text-violet-700",
            barClass: "bg-violet-500",
            borderClass: "border-l-violet-300",
            items: [
              { term: "Helpful Rate", def: "Percentage of KB article ratings marked 'helpful' across the whole tenant. Reflects KB quality overall, not individual agent performance." },
              { term: "Queries Handled", def: "KB searches you have performed today. Resets at midnight." },
              { term: "Cases Resolved", def: "Total customer cases marked resolved — all time." },
              { term: "Articles Opened", def: "Total articles viewed since your account was created. Tracked for KB usage reporting." },
              { term: "This week", def: "Activity from the last 7 days (rolling window, not the calendar week)." },
            ],
          },
          {
            category: "Chat & Cases",
            badgeClass: "bg-green-50 border-green-100 text-green-700",
            barClass: "bg-green-500",
            borderClass: "border-l-green-300",
            items: [
              { term: "Case", def: "A customer support request. Status: Waiting (unassigned), Active (you are handling it), or Resolved (complete)." },
              { term: "Priority", def: "Urgency level — High, Medium, or Low. Set based on the nature of the customer's issue." },
              { term: "KB Assistant", def: "AI-powered panel inside the chat view. Automatically searches the KB based on the customer's messages and suggests relevant articles." },
              { term: "Report a Gap (from chat)", def: "Flag that no KB article answers the customer's question. Creates a Knowledge Gap entry for admins to review and fix." },
            ],
          },
          {
            category: "Gap Reports",
            badgeClass: "bg-amber-50 border-amber-100 text-amber-700",
            barClass: "bg-amber-500",
            borderClass: "border-l-amber-300",
            items: [
              { term: "Knowledge Gap", def: "A topic the KB has no good answer for — created when searches fail or you manually flag missing content." },
              { term: "Gap Report", def: "A formal submission flagging a missing KB article. Includes the original query, your optional comment, and the flagged article if any." },
              { term: "Occurrences", def: "How many times the same gap was triggered. High-occurrence gaps are prioritised by admins for new content." },
              { term: "Resolved", def: "A gap marked done by an admin after a new article was published or an existing one improved." },
              { term: "Pending", def: "A gap that has been submitted but not yet addressed by an admin." },
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
                <p className="text-xs text-zinc-500">Definitions for every term, metric, and feature in this workspace.</p>
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
      </div>
    </div>
  );
}
