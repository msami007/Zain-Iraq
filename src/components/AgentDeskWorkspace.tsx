"use client";

import { useState, useEffect } from "react";
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

  // Top level Console Active Tab
  const [agentActiveTab, setAgentActiveTab] = useState<"tickets" | "chat">("tickets");

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

  // Selected article detail state for resolution preview
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  // Workspace tab: kb search vs custom reply vs pinned
  const [workspaceTab, setWorkspaceTab] = useState<"kb" | "reply" | "pinned">("kb");
  const [customReply, setCustomReply] = useState("");
  const [resolvingManually, setResolvingManually] = useState(false);

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
      setChatKbResults(data.results || []);
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
      alert(err.message);
    }
  };

  const handlePasteMacro = (macroText: string, articleId: string, articleTitle: string) => {
    setChatInputText(macroText);
    alert("Macro content pasted into text field!");

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

  const handleResolveManually = async (caseId: string) => {
    if (!customReply.trim()) {
      alert("Please write your reply before resolving.");
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
      alert("Case resolved with your custom reply.");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setResolvingManually(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Level Console Navigation */}
      <div className="flex border-b border-zinc-200 pb-3 justify-start gap-4">
        <button
          type="button"
          onClick={() => setAgentActiveTab("tickets")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            agentActiveTab === "tickets"
              ? "bg-zinc-950 text-white shadow-xs"
              : "bg-white text-zinc-650 hover:bg-zinc-50 border border-zinc-200"
          }`}
        >
          🎟️ Tickets Console
        </button>
        <button
          type="button"
          onClick={() => setAgentActiveTab("chat")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            agentActiveTab === "chat"
              ? "bg-zinc-950 text-white shadow-xs"
              : "bg-white text-zinc-650 hover:bg-zinc-50 border border-zinc-200"
          }`}
        >
          💬 Customer Chat Console
        </button>
      </div>

      {agentActiveTab === "tickets" && (
        <>
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

              {/* Case Workspace */}
              {selectedCase.status === "active" && (
                <div className="space-y-6">
                  {/* Tab Switcher */}
                  <div className="flex gap-1 rounded-lg bg-zinc-100 border border-zinc-200 p-1">
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("kb")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        workspaceTab === "kb"
                          ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      Search Knowledge Base
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("pinned")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        workspaceTab === "pinned"
                          ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      Pinned ({pinnedArticleIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("reply")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        workspaceTab === "reply"
                          ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      Write Custom Reply
                    </button>
                  </div>

                  {/* Custom Reply Tab */}
                  {workspaceTab === "reply" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                          Your Response to Customer
                        </label>
                        <textarea
                          value={customReply}
                          onChange={(e) => setCustomReply(e.target.value)}
                          placeholder={`Write your reply to ${selectedCase.customer_name} here...\n\nExample:\n"Thank you for reaching out. I checked your account and found that your data bundle is pending activation. Please follow these steps: ..."`}
                          rows={10}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden transition-all shadow-xs font-medium leading-relaxed resize-none"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-zinc-400 font-medium">{customReply.length} characters</span>
                          {customReply.length > 0 && (
                            <button
                              onClick={() => navigator.clipboard.writeText(customReply)}
                              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 underline"
                            >
                              Copy to clipboard
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2 border-t border-zinc-100">
                        <button
                          onClick={() => setCustomReply("")}
                          className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600 transition-all"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => handleResolveManually(selectedCase.id)}
                          disabled={resolvingManually || !customReply.trim()}
                          className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
                        >
                          {resolvingManually ? "Resolving..." : "Resolve with This Reply"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pinned Articles Tab */}
                  {workspaceTab === "pinned" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Pinned Articles</h4>
                      {pinnedArticleIds.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No pinned articles yet. Pin articles from search results for quick access.</p>
                      ) : (
                        <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-2 max-h-[300px] overflow-y-auto">
                          {publishedArticles
                            .filter(a => pinnedArticleIds.includes(a.id))
                            .map((art) => (
                              <div key={art.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-zinc-800 font-bold">{art.title}</strong>
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePin(art.id)}
                                      className="text-xs hover:scale-110 transition-transform"
                                      title="Unpin"
                                    >
                                      📌
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">Category: {art.category?.name || "—"}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handlePreviewArticle(art.id)}
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

                  {/* KB Search Tab */}
                  {workspaceTab === "kb" && (
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

                    {/* Search Filters Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-450 uppercase block mb-1">Language</label>
                        <select
                          value={searchLanguage}
                          onChange={(e) => setSearchLanguage(e.target.value)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-hidden"
                        >
                          <option value="en">English (EN)</option>
                          <option value="ar">Arabic (AR)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-450 uppercase block mb-1">Category</label>
                        <select
                          value={searchCategory}
                          onChange={(e) => setSearchCategory(e.target.value)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-hidden"
                        >
                          <option value="">All Categories</option>
                          {uniqueCategories.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-450 uppercase block mb-1">From Date</label>
                        <input
                          type="date"
                          value={searchStartDate}
                          onChange={(e) => setSearchStartDate(e.target.value)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-450 uppercase block mb-1">To Date</label>
                        <input
                          type="date"
                          value={searchEndDate}
                          onChange={(e) => setSearchEndDate(e.target.value)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] focus:outline-hidden"
                        />
                      </div>
                    </div>
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
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePin(r.article_id)}
                                    className="text-xs hover:scale-110 transition-all select-none"
                                    title={pinnedArticleIds.includes(r.article_id) ? "Unpin Article" : "Pin Article"}
                                  >
                                    {pinnedArticleIds.includes(r.article_id) ? "📌" : "📍"}
                                  </button>
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
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-zinc-950">Active Ticket Workspace</h3>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">Select a ticket from the queue to begin</p>
                </div>
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  No Ticket Selected
                </span>
              </div>

              {/* Example ticket — shown as a dimmed preview to orient the agent */}
              <div className="opacity-40 pointer-events-none select-none space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Customer</span>
                    <strong className="text-zinc-800">Ahmed Al-Rashidi</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Subject</span>
                    <strong className="text-zinc-800">Data bundle not activating</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Priority</span>
                    <strong className="text-zinc-800 uppercase">High</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Wait Started</span>
                    <strong className="text-zinc-800">Today, 09:14 AM</strong>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1.5">Customer Query</span>
                  <p className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700 font-medium leading-relaxed italic">
                    "I purchased the 5GB monthly data bundle this morning but my phone still shows I have 0MB remaining. I tried restarting my device but nothing changed. Can you help?"
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">KB Workspace Search</span>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-400">data bundle activation issue...</div>
                    <div className="rounded bg-zinc-900 px-3 py-2 text-xs font-bold text-white">Search</div>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { title: "How to Activate a Data Bundle", score: "98%" },
                      { title: "Troubleshoot: Bundle Shows 0MB After Purchase", score: "91%" },
                      { title: "Data Bundle Activation Delay — Known Issue", score: "84%" },
                    ].map((r) => (
                      <div key={r.title} className="flex items-center justify-between rounded border border-zinc-200 bg-white px-3 py-2">
                        <span className="text-xs font-semibold text-zinc-700">{r.title}</span>
                        <span className="text-[10px] font-bold text-green-600">{r.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-6 text-center space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 mx-auto">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="13" y2="17"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-600">Select a ticket from the queue</p>
                  <p className="text-xs text-zinc-400 font-medium mt-1 max-w-sm mx-auto leading-relaxed">
                    Pick any <span className="font-bold text-zinc-500">Waiting</span> ticket on the left, claim it, then search the knowledge base to find the right article and resolve the case.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-6 pt-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    1. Select ticket
                  </span>
                  <span className="text-zinc-200">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    2. Claim it
                  </span>
                  <span className="text-zinc-200">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    3. Search KB
                  </span>
                  <span className="text-zinc-200">→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    4. Resolve
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )}

      {/* CUSTOMER CHAT CONSOLE VIEW */}
      {agentActiveTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-h-[600px] text-left">
          {/* LEFT PANEL: Active chat sessions */}
          <div className="lg:col-span-3 rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Conversations</h3>
            </div>
            <div className="divide-y divide-zinc-150 max-h-[480px] overflow-y-auto">
              {chatSessions.map((s) => (
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
                  className={`w-full p-4 text-left transition-colors flex items-center gap-3 hover:bg-zinc-50 ${
                    activeChatSessionId === s.id ? "bg-zinc-50 border-l-4 border-zinc-950 font-bold" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-150 flex items-center justify-center font-bold text-xs text-zinc-650 shrink-0 shadow-2xs">
                    {s.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-zinc-900 truncate">{s.customerName}</div>
                    <div className="text-[10px] text-zinc-450 truncate mt-0.5">{s.lastMessage}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER PANEL: Customer message stream + message input */}
          <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6 flex flex-col justify-between min-h-[500px]">
            {(() => {
              const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
              if (!activeSession) return <div className="text-xs text-zinc-400 italic">Select a chat to begin.</div>;

              return (
                <>
                  {/* Chat Session Header */}
                  <div className="border-b border-zinc-150 pb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-xs text-zinc-800 shadow-2xs">
                      {activeSession.avatar}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">{activeSession.customerName}</h4>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600 uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Live Chat
                      </span>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[300px] max-h-[350px]">
                    {activeSession.messages.map((m, idx) => {
                      const isAgent = m.sender === "agent";
                      return (
                        <div key={idx} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                            isAgent
                              ? "bg-zinc-950 text-white rounded-tr-none"
                              : "bg-zinc-100 text-zinc-800 rounded-tl-none border border-zinc-200"
                          }`}>
                            <p className="font-semibold leading-relaxed whitespace-pre-wrap">{m.text}</p>
                            <span className={`text-[8px] mt-1 block text-right font-medium ${isAgent ? "text-zinc-400" : "text-zinc-400"}`}>
                              {m.time}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendChatMessage} className="border-t border-zinc-150 pt-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type your message or paste KB macro..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-805 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden transition-all shadow-xs bg-white"
                    />
                    <button
                      type="submit"
                      disabled={!chatInputText.trim()}
                      className="rounded bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
                    >
                      Send
                    </button>
                  </form>
                </>
              );
            })()}
          </div>

          {/* RIGHT PANEL: Integrated KB Search widget */}
          <div className="lg:col-span-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-5 text-left min-h-[500px]">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">KB Assistant Widget</h4>
              <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Search and insert macro replies instantly.</p>
            </div>

            <form onSubmit={handleChatSearchKB} className="flex gap-2">
              <input
                type="text"
                placeholder="Search KB..."
                value={chatKbQuery}
                onChange={(e) => setChatKbQuery(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-hidden bg-white"
              />
              <button
                type="submit"
                className="rounded bg-zinc-900 hover:bg-zinc-850 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                Search
              </button>
            </form>

            {chatSearched && (
              <div className="border border-zinc-150 rounded-lg p-3 bg-zinc-50 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block border-b border-zinc-200 pb-1">
                  Matching Articles ({chatKbResults.length})
                </span>
                {chatSearching ? (
                  <div className="text-[10px] text-zinc-400 animate-pulse py-2 font-bold">Searching...</div>
                ) : chatKbResults.length === 0 ? (
                  <div className="text-[10px] text-zinc-400 italic py-2">No matches found.</div>
                ) : (
                  <div className="divide-y divide-zinc-200 max-h-[140px] overflow-y-auto space-y-1">
                    {chatKbResults.map((r) => (
                      <div key={r.article_id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-zinc-800 truncate flex-1">{r.title}</span>
                        <button
                          type="button"
                          onClick={() => handleChatPreviewArticle(r.article_id)}
                          className="rounded border border-zinc-300 bg-white hover:bg-zinc-50 px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-700 shrink-0"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {chatPreviewArticle && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-3 shadow-2xs text-xs">
                <div className="border-b border-zinc-100 pb-1.5">
                  <h5 className="font-bold text-zinc-900 leading-tight truncate">{chatPreviewArticle.title}</h5>
                  <span className="text-[9px] text-zinc-400 font-medium">Category: {chatPreviewArticle.category?.name || "—"}</span>
                </div>

                {chatPreviewArticle.variants?.find((v: any) => v.channel === "agent")?.copy_ready_macro ? (
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block">Macro Reply Content</span>
                    <pre className="rounded bg-zinc-950 p-2.5 font-mono text-[9px] text-zinc-300 overflow-x-auto max-h-[70px] whitespace-pre-wrap">
                      {chatPreviewArticle.variants.find((v: any) => v.channel === "agent").copy_ready_macro}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handlePasteMacro(
                        chatPreviewArticle.variants.find((v: any) => v.channel === "agent").copy_ready_macro,
                        chatPreviewArticle.id,
                        chatPreviewArticle.title
                      )}
                      className="w-full rounded bg-green-600 hover:bg-green-700 px-3 py-1.5 text-[10px] font-bold text-white transition-all shadow-xs text-center block"
                    >
                      📋 Paste Macro to Chat
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-450 italic">No agent macro variant available for this article.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
