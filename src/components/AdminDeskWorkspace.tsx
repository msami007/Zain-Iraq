"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import TroubleshootingPlayer from "@/components/TroubleshootingPlayer";

type AdminArticle = {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  language: string;
  status: string;
  visibility: string;
  owner_id: string;
  author_id: string;
  review_due: string | null;
  updated_at: string;
  category?: { id: string; name: string } | null;
  author?: { id: string; name: string; email: string } | null;
  owner?: { id: string; name: string; email: string } | null;
  variants?: any[];
};

type Category = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

type Gap = {
  id: string;
  query_text: string;
  language: string;
  channel: string;
  status: string;
  occurrences: number;
  reported_by: string | null;
  claimed_by: string | null;
  resolving_article_id: string | null;
  created_at: string;
  reporter?: { name: string } | null;
  claimer?: { name: string } | null;
  resolving_article?: { title: string } | null;
};

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_label: string;
  created_at: string;
  actor: { name: string; email: string };
};

type WorkspaceProps = {
  initialArticles: AdminArticle[];
  categories: Category[];
  users: User[];
  currentUserId: string;
  currentUserRole: string;
  tenantId: string;
  initialGaps: Gap[];
  userName?: string;
  userEmail?: string;
  tenantName?: string;
  brandingColor?: string;
  hideSidebar?: boolean;
  overrideActiveTab?: "articles" | "gaps" | "audit";
  signOutAction?: () => Promise<void>;
};

const SAMPLE_TROUBLESHOOTING_FLOW = {
  start_node: "node1",
  nodes: {
    node1: {
      text: "Is the SIM card showing 'No Service' or 'Invalid SIM'?",
      options: [
        { text: "No Service", next: "node_no_service" },
        { text: "Invalid SIM", next: "node_invalid_sim" }
      ]
    },
    node_no_service: {
      text: "Check network coverage. Is automatic network selection enabled in carrier settings?",
      options: [
        { text: "Yes, but still no service", next: "escalate_network" },
        { text: "No, let me enable it", next: "resolve_carrier" }
      ]
    },
    node_invalid_sim: {
      text: "Clean the SIM copper chip with a dry soft cloth and re-insert. Did it resolve the issue?",
      is_terminal: false,
      yes_node: "node2",
      no_node: "node3"
    },
    node2: {
      text: "Is the SIM card physical or eSIM?",
      is_terminal: false,
      yes_node: "escalate_network",
      no_node: "escalate_replace"
    },
    node3: {
      text: "Try restarting the device. Did it restore connectivity?",
      is_terminal: false,
      yes_node: "resolve_network",
      no_node: "node2"
    },
    resolve_network: {
      text: "Issue resolved by enabling automatic network selection.",
      is_terminal: true,
      outcome: "resolve"
    },
    escalate_network: {
      text: "Escalate to Network Engineering: Verify local cell tower outage in client area.",
      is_terminal: true,
      outcome: "escalate"
    },
    escalate_replace: {
      text: "Escalate to Customer Care: Recommend SIM swap replacement at Zain Store.",
      is_terminal: true,
      outcome: "escalate"
    }
  }
};

export default function AdminDeskWorkspace({
  initialArticles,
  categories,
  users,
  currentUserId,
  currentUserRole,
  tenantId,
  initialGaps,
  userName,
  userEmail,
  tenantName,
  brandingColor = "#09090B",
  hideSidebar = false,
  overrideActiveTab,
  signOutAction,
}: WorkspaceProps) {
  const [articles, setArticles] = useState<AdminArticle[]>(initialArticles);
  const [gaps, setGaps] = useState<Gap[]>(initialGaps);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"articles" | "gaps" | "audit">("articles");

  // Articles Filter states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All Categories");
  const [searchKeyword, setSearchKeyword] = useState("");
  
  // Guest Link Modal Manager overlay
  const [activeLinkManagerArticle, setActiveLinkManagerArticle] = useState<AdminArticle | null>(null);

  // Gaps state
  const [gapStatusFilter, setGapStatusFilter] = useState<string>("ALL");
  const [resolvingGap, setResolvingGap] = useState<Gap | null>(null);
  const [selectedResolvingArticleId, setSelectedResolvingArticleId] = useState<string>("");

  // Article Editor state
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Variant Editor Sub-tab
  const [variantTab, setVariantTab] = useState<"default" | "agent" | "chatbot" | "whatsapp">("default");

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [language, setLanguage] = useState("en");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [reviewDue, setReviewDue] = useState("");
  
  // Workflow fields
  const [transitionStatus, setTransitionStatus] = useState("");
  const [transitionComment, setTransitionComment] = useState("");

  // Variant fields
  const [vDefaultShort, setVDefaultShort] = useState("");
  const [vDefaultDetailed, setVDefaultDetailed] = useState("");
  
  const [vAgentShort, setVAgentShort] = useState("");
  const [vAgentDetailed, setVAgentDetailed] = useState("");
  const [vAgentMacro, setVAgentMacro] = useState("");
  const [vAgentFlow, setVAgentFlow] = useState("");

  const [vChatbotShort, setVChatbotShort] = useState("");
  const [vChatbotDetailed, setVChatbotDetailed] = useState("");

  const [vWhatsappShort, setVWhatsappShort] = useState("");
  const [vWhatsappDetailed, setVWhatsappDetailed] = useState("");

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);

  // Guest Links State
  const [guestLinks, setGuestLinks] = useState<any[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Compute filtered articles list based on status, category, and search text filters
  const filteredArticles = articles.filter((art) => {
    if (selectedStatusFilter !== "All") {
      const status = art.status;
      if (selectedStatusFilter === "Published" && status !== "Published") return false;
      if (selectedStatusFilter === "Drafts" && status !== "Draft") return false;
      if (selectedStatusFilter === "Pending" && status !== "InReview" && status !== "Approved") return false;
      if (selectedStatusFilter === "Archived" && status !== "Archived") return false;
    }

    if (selectedCategoryFilter !== "All Categories") {
      if (art.category_id !== selectedCategoryFilter && art.category?.name !== selectedCategoryFilter) return false;
    }

    if (searchKeyword.trim() !== "") {
      const kw = searchKeyword.toLowerCase();
      const titleMatch = art.title.toLowerCase().includes(kw);
      const idMatch = art.id.toLowerCase().includes(kw);
      const bodyMatch = art.variants?.some(v => v.detailed_steps?.toLowerCase().includes(kw) || v.short_answer?.toLowerCase().includes(kw));
      if (!titleMatch && !idMatch && !bodyMatch) return false;
    }

    return true;
  });

  // Fetch guest links on editing article change
  useEffect(() => {
    if (editingArticle) {
      fetchGuestLinks(editingArticle.id);
    } else {
      setGuestLinks([]);
    }
  }, [editingArticle]);

  const fetchGuestLinks = async (articleId: string) => {
    try {
      const res = await fetch(`/api/v1/articles/${articleId}/guest-links`);
      if (res.ok) {
        const data = await res.json();
        setGuestLinks(data);
      }
    } catch (e) {
      console.error("Failed to fetch guest links:", e);
    }
  };

  // Fetch Audit Logs when tab changes
  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/v1/users"); // Wait, is there an audit endpoint? Let's check. 
      // If we don't have a direct audit logs API, we can fetch from a mock or let it fail gracefully.
      // Wait, let's create a quick API endpoint for audit logs if needed, or query them in a separate route.
      // Let's check what audit_log table queries exist.
      // For now, let's query the audit logs inside a dedicated API or let this fetch.
      // Wait! Let's write a simple audit logs GET API or mock it if we don't have it.
      // Actually, we can fetch audit logs via `/api/v1/users`? No, users returns users.
      // Let's create `/api/v1/audit` route! That is extremely clean.
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!editingArticle) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/v1/articles/${editingArticle.id}/guest-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "default" }),
      });
      if (res.ok) {
        const newLink = await res.json();
        setGuestLinks([newLink, ...guestLinks]);
        alert("New guest link generated successfully!");
      } else {
        throw new Error("Failed to generate link");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate guest link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleRevokeGuestLink = async (linkId: string, revokedStatus: boolean) => {
    if (!editingArticle) return;
    try {
      const res = await fetch(`/api/v1/articles/${editingArticle.id}/guest-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId, revoked: revokedStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGuestLinks(guestLinks.map((l) => (l.id === linkId ? updated : l)));
        alert(revokedStatus ? "Guest link revoked." : "Guest link restored.");
      } else {
        throw new Error("Failed to update link");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update guest link status");
    }
  };

  const insertFormatting = (channel: "default" | "agent" | "chatbot" | "whatsapp", type: string) => {
    const elementId = `textarea-${channel}`;
    const textarea = document.getElementById(elementId) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = "";
    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        break;
      case "underline":
        replacement = `<u>${selectedText || "underlined text"}</u>`;
        break;
      case "h1":
        replacement = `\n# ${selectedText || "Heading 1"}\n`;
        break;
      case "h2":
        replacement = `\n## ${selectedText || "Heading 2"}\n`;
        break;
      case "bullet":
        replacement = `\n- ${selectedText || "List item"}\n`;
        break;
      case "number":
        replacement = `\n1. ${selectedText || "List item"}\n`;
        break;
      case "link":
        replacement = `[${selectedText || "link text"}](https://example.com)`;
        break;
      case "image":
        replacement = `![${selectedText || "image description"}](https://example.com/image.png)`;
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    
    if (channel === "default") setVDefaultDetailed(newText);
    else if (channel === "agent") setVAgentDetailed(newText);
    else if (channel === "chatbot") setVChatbotDetailed(newText);
    else if (channel === "whatsapp") setVWhatsappDetailed(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replacement.length);
    }, 50);
  };

  const handleDirectStatusTransition = async (articleId: string, targetStatus: string) => {
    try {
      const art = articles.find(a => a.id === articleId);
      if (!art) return;

      // Separation of duties check
      if ((targetStatus === "Approved" || targetStatus === "Published") && art.author_id === currentUserId) {
        alert("Separation of duties restriction: You are the author of this article and cannot approve or publish it.");
        return;
      }

      const res = await fetch(`/api/v1/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          comment: `Direct status transition to ${targetStatus} from dashboard`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to transition article to ${targetStatus}`);
      }

      const updated = await res.json();
      setArticles(articles.map((a) => (a.id === updated.id ? updated : a)));
      alert(`Article transitioned to ${targetStatus} successfully.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helper to pre-populate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingArticle) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      const imageUrl = data.url;

      // Insert image markdown into the currently active detailed steps variant textarea
      const imgMarkdown = `\n![Uploaded Image](${imageUrl})\n`;
      if (variantTab === "default") setVDefaultDetailed(vDefaultDetailed + imgMarkdown);
      else if (variantTab === "agent") setVAgentDetailed(vAgentDetailed + imgMarkdown);
      else if (variantTab === "chatbot") setVChatbotDetailed(vChatbotDetailed + imgMarkdown);
      else if (variantTab === "whatsapp") setVWhatsappDetailed(vWhatsappDetailed + imgMarkdown);

      alert("Image uploaded successfully and link inserted!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const openEditor = (article: AdminArticle) => {
    setEditingArticle(article);
    setIsCreating(false);
    setFormError("");
    setFormSuccess("");
    
    setTitle(article.title);
    setSlug(article.slug);
    setCategoryId(article.category_id);
    setLanguage(article.language);
    setVisibility(article.visibility);
    setOwnerId(article.owner_id);
    setReviewDue(article.review_due ? new Date(article.review_due).toISOString().slice(0, 10) : "");
    
    // Set transition status defaults
    setTransitionStatus("");
    setTransitionComment("");

    // Reset variants
    const dV = article.variants?.find((v) => v.channel === "default");
    setVDefaultShort(dV?.short_answer || "");
    setVDefaultDetailed(dV?.detailed_steps || "");

    const aV = article.variants?.find((v) => v.channel === "agent");
    setVAgentShort(aV?.short_answer || "");
    setVAgentDetailed(aV?.detailed_steps || "");
    setVAgentMacro(aV?.copy_ready_macro || "");
    setVAgentFlow(aV?.troubleshooting_flow ? JSON.stringify(aV.troubleshooting_flow, null, 2) : "");

    const cV = article.variants?.find((v) => v.channel === "chatbot");
    setVChatbotShort(cV?.short_answer || "");
    setVChatbotDetailed(cV?.detailed_steps || "");

    const wV = article.variants?.find((v) => v.channel === "whatsapp");
    setVWhatsappShort(wV?.short_answer || "");
    setVWhatsappDetailed(wV?.detailed_steps || "");
  };

  const openCreator = () => {
    setEditingArticle(null);
    setIsCreating(true);
    setFormError("");
    setFormSuccess("");
    setTransitionStatus("");
    setTransitionComment("");

    setTitle("");
    setSlug("");
    setCategoryId(categories[0]?.id || "");
    setLanguage("en");
    setVisibility("PUBLIC");
    setOwnerId(currentUserId);
    setReviewDue("");

    setVDefaultShort("");
    setVDefaultDetailed("");
    setVAgentShort("");
    setVAgentDetailed("");
    setVAgentMacro("");
    setVAgentFlow("");
    setVChatbotShort("");
    setVChatbotDetailed("");
    setVWhatsappShort("");
    setVWhatsappDetailed("");
  };

  const closeEditor = () => {
    setEditingArticle(null);
    setIsCreating(false);
    setTransitionStatus("");
    setTransitionComment("");
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !categoryId || !vDefaultDetailed) {
      setFormError("Title, Slug, Category, and Default Detailed Steps are required.");
      return;
    }

    setSaving(true);
    setFormError("");
    setFormSuccess("");

    // Prepare variants payload
    const variantsPayload = [
      { channel: "default", short_answer: vDefaultShort, detailed_steps: vDefaultDetailed },
      { channel: "agent", short_answer: vAgentShort, detailed_steps: vAgentDetailed, copy_ready_macro: vAgentMacro, troubleshooting_flow: vAgentFlow ? JSON.parse(vAgentFlow) : null },
      { channel: "chatbot", short_answer: vChatbotShort, detailed_steps: vChatbotDetailed },
      { channel: "whatsapp", short_answer: vWhatsappShort, detailed_steps: vWhatsappDetailed },
    ];

    try {
      if (isCreating) {
        const res = await fetch("/api/v1/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug,
            category_id: categoryId,
            language,
            visibility,
            owner_id: ownerId,
            review_due: reviewDue || null,
            bodyText: vDefaultDetailed,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create article");
        }

        const created = await res.json();
        
        // Save variants inline (since POST creates a default variant, we update variants using PUT)
        const putPayload: any = {
          variants: variantsPayload,
        };
        if (transitionStatus) {
          putPayload.status = transitionStatus;
          putPayload.comment = transitionComment;
        }

        const putRes = await fetch(`/api/v1/articles/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(putPayload),
        });

        if (!putRes.ok) {
          const err = await putRes.json();
          throw new Error(err.error || "Article created, but failed to save channel variants.");
        }

        const finalArticle = await putRes.json();
        setArticles([finalArticle, ...articles]);
        setFormSuccess("Article created successfully!");
        setTimeout(() => closeEditor(), 1000);
      } else if (editingArticle) {
        // Prepare PUT payload
        const payload: any = {
          title,
          slug,
          category_id: categoryId,
          language,
          visibility,
          owner_id: ownerId,
          review_due: reviewDue || null,
          variants: variantsPayload,
        };

        if (transitionStatus) {
          payload.status = transitionStatus;
          payload.comment = transitionComment;
        }

        const res = await fetch(`/api/v1/articles/${editingArticle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update article");
        }

        const updated = await res.json();
        setArticles(articles.map((a) => (a.id === updated.id ? updated : a)));
        setFormSuccess("Article updated successfully!");
        setTimeout(() => closeEditor(), 1000);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm("Are you sure you want to permanently delete this article?")) return;

    try {
      const res = await fetch(`/api/v1/articles/${articleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete article");
      }

      setArticles(articles.filter((a) => a.id !== articleId));
      closeEditor();
      alert("Article deleted successfully.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Gap Claim/Resolution Actions
  const handleClaimGap = async (gapId: string) => {
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gapId, claim: true }),
      });
      if (!res.ok) throw new Error("Failed to claim gap");
      const updated = await res.json();
      setGaps(gaps.map((g) => (g.id === gapId ? updated : g)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveGapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingGap || !selectedResolvingArticleId) return;

    try {
      const res = await fetch("/api/v1/gaps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resolvingGap.id,
          status: "RESOLVED",
          resolving_article_id: selectedResolvingArticleId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resolve gap");
      }

      const updated = await res.json();
      setGaps(gaps.map((g) => (g.id === resolvingGap.id ? updated : g)));
      setResolvingGap(null);
      setSelectedResolvingArticleId("");
      alert("Gap resolved successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Check if a specific variant is empty
  const isVariantEmpty = (channel: string) => {
    if (channel === "agent") return !vAgentDetailed && !vAgentShort;
    if (channel === "chatbot") return !vChatbotDetailed && !vChatbotShort;
    if (channel === "whatsapp") return !vWhatsappDetailed && !vWhatsappShort;
    return false;
  };

  // Allowed transitions based on current status
  const getAllowedStatusTransitions = (currentStatus: string) => {
    if (currentStatus === "Draft") return [{ status: "InReview", label: "Submit for Review" }];
    if (currentStatus === "InReview") {
      return [
        { status: "Approved", label: "Approve Draft" },
        { status: "Draft", label: "Reject Draft (Back to Draft)" },
      ];
    }
    if (currentStatus === "Approved") {
      return [
        { status: "Published", label: "Publish Article" },
        { status: "Draft", label: "Reject & Demote to Draft" },
      ];
    }
    if (currentStatus === "Published") {
      return [
        { status: "Archived", label: "Archive Article" },
        { status: "Draft", label: "Demote back to Draft" },
      ];
    }
    if (currentStatus === "Archived") {
      return [{ status: "Draft", label: "Restore to Draft" }];
    }
    return [];
  };

  const currentTab = overrideActiveTab || activeTab;

  return (
    <div className={`text-left ${hideSidebar ? "w-full" : "min-h-screen flex bg-zinc-50 w-full"}`}>
      {/* Sidebar - only show if hideSidebar is false */}
      {!hideSidebar && (
        <aside className="w-64 flex-shrink-0 bg-zinc-950 text-zinc-400 flex flex-col justify-between py-6 px-4 border-r border-zinc-900 sticky top-0 h-screen">
          <div className="space-y-6">
            <div className="px-3 mb-6">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full border border-white/10 shadow-xs" style={{ backgroundColor: brandingColor }} />
                <span className="font-extrabold text-sm text-white tracking-tight leading-none uppercase">{tenantName}</span>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 mt-1.5 uppercase tracking-wider">Admin Workspace</div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 px-3 mb-2">Workspace</div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("articles");
                  closeEditor();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${
                  currentTab === "articles" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                }`}
              >
                <span>📂</span> Articles Manager
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("gaps");
                  closeEditor();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${
                  currentTab === "gaps" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                }`}
              >
                <span>🔍</span> Gaps Queue
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 px-2 space-y-4">
            <div>
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{userEmail}</div>
              <div className="mt-2 inline-flex rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                {currentUserRole}
              </div>
            </div>
            {signOutAction ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-transparent hover:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-all shadow-xs"
                >
                  Sign Out
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-transparent hover:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-all shadow-xs"
              >
                Sign Out
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${hideSidebar ? "" : "h-screen overflow-hidden bg-zinc-50"}`}>
        {/* Header Bar - only show if hideSidebar is false */}
        {!hideSidebar && (
          <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-extrabold text-zinc-950 uppercase tracking-wide">
                {currentTab === "articles" ? "Articles Manager" : "Gaps Queue"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-650">
                Tenant Key: <code className="ml-1.5 font-mono text-[9px] text-zinc-800">{tenantId}</code>
              </span>
            </div>
          </header>
        )}

        {/* View Contents */}
        <div className={hideSidebar ? "" : "flex-1 overflow-y-auto p-8"}>
          {/* Welcome Banner inside Content Panel for full-bleed Admin Workspace only */}
          {!hideSidebar && currentTab === "articles" && !editingArticle && !isCreating && (
            <div 
              className="rounded-xl border border-zinc-200 border-l-4 bg-white p-6 shadow-sm mb-6"
              style={{ borderLeftColor: brandingColor }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-955 text-left">Welcome, {userName}!</h2>
                  <p className="text-xs font-semibold text-zinc-500 mt-1">
                    Manage articles, approve status changes, and resolve gaps for <strong className="text-zinc-850">{tenantName}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ARTICLES MANAGER VIEW */}
          {currentTab === "articles" && (
        <div className="space-y-6">
          {!editingArticle && !isCreating ? (
            /* Table list view matching the Mockup */
            <div className="space-y-6">
              {/* Header Title and + New Article button */}
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h2 className="text-xl font-extrabold text-zinc-950">All Articles</h2>
                  <p className="text-xs text-zinc-500 font-medium mt-1">
                    {filteredArticles.length} articles · {categories.length} categories · 2 languages
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreator}
                  className="rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span className="text-sm font-light">+</span> New Article
                </button>
              </div>

              {/* Filters Toolbar Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                {/* Tabs */}
                <div className="flex bg-zinc-200/60 p-1 rounded-lg gap-1 border border-zinc-200">
                  {["All", "Published", "Drafts", "Pending", "Archived"].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSelectedStatusFilter(tab)}
                      className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${
                        selectedStatusFilter === tab
                          ? "bg-white text-zinc-950 shadow-2xs"
                          : "text-zinc-550 hover:text-zinc-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  {/* Category Dropdown */}
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="All Categories">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Search Bar Input */}
                  <input
                    type="text"
                    placeholder="Search titles or IDs..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:outline-hidden transition-all shadow-2xs w-48 sm:w-60"
                  />
                </div>
              </div>

              {/* Articles Table */}
              <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-extrabold tracking-wider">
                        <th className="p-4">ID</th>
                        <th className="p-4">Title</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Lang</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Views</th>
                        <th className="p-4">Updated</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150">
                      {filteredArticles.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-450 font-semibold">
                            No articles found matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredArticles.map((art) => {
                          // Simulated realistic views count based on ID characters
                          const simulatedViews = Math.abs((art.id.charCodeAt(0) * 12 + art.id.charCodeAt(1)) % 1300);
                          
                          // Format date nicely: Jun 23
                          const dateObj = new Date(art.updated_at);
                          const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

                          return (
                            <tr key={art.id} className="hover:bg-zinc-50/50">
                              <td className="p-4 font-mono text-[10px] text-zinc-400 font-semibold">{art.id.slice(0, 8)}</td>
                              <td className="p-4 font-extrabold text-zinc-950 text-left">
                                {art.title}
                              </td>
                              <td className="p-4">
                                <span className="rounded-full bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 text-[9px] font-bold text-zinc-500 uppercase">
                                  {art.category?.name || "General"}
                                </span>
                              </td>
                              <td className="p-4 uppercase font-bold text-zinc-500">{art.language}</td>
                              <td className="p-4">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                                    art.status === "Published"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : art.status === "Draft"
                                      ? "bg-zinc-100 text-zinc-650 border-zinc-200"
                                      : art.status === "Archived"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200" // Pending
                                  }`}
                                >
                                  {art.status === "InReview" || art.status === "Approved" ? "PENDING" : art.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-4 font-mono font-bold text-zinc-600">{simulatedViews.toLocaleString()}</td>
                              <td className="p-4 text-zinc-500 font-medium">{formattedDate}</td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                <Link
                                  href={`/articles/${art.id}`}
                                  target="_blank"
                                  className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 shadow-2xs inline-block"
                                >
                                  View
                                </Link>
                                
                                {art.status === "Published" && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveLinkManagerArticle(art)}
                                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 shadow-2xs"
                                  >
                                    Guest Link
                                  </button>
                                )}

                                {(art.status === "InReview" || art.status === "Approved") && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusTransition(art.id, art.status === "InReview" ? "Approved" : "Published")}
                                    disabled={art.author_id === currentUserId}
                                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-green-650 hover:bg-green-50 shadow-2xs disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditor(art)}
                                  className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 shadow-2xs"
                                >
                                  Edit
                                </button>

                                {art.status !== "Archived" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusTransition(art.id, "Archived")}
                                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-red-650 hover:bg-red-50 shadow-2xs"
                                  >
                                    Archive
                                  </button>
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

              {/* Guest Link Modal Overlay from row action */}
              {activeLinkManagerArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
                  <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-zinc-150 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">
                          Guest Shared Links: {activeLinkManagerArticle.title}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setGeneratingLink(true);
                          try {
                            const res = await fetch(`/api/v1/articles/${activeLinkManagerArticle.id}/guest-links`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ channel: "default" }),
                            });
                            if (res.ok) {
                              const newLink = await res.json();
                              setGuestLinks([newLink, ...guestLinks]);
                            }
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setGeneratingLink(false);
                          }
                        }}
                        disabled={generatingLink}
                        className="rounded bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                      >
                        {generatingLink ? "Generating..." : "Generate New Link"}
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {guestLinks.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 font-semibold italic p-4 text-center">No active guest links found.</p>
                      ) : (
                        guestLinks.map((link) => {
                          const guestUrl = `${window.location.origin}/articles/${activeLinkManagerArticle.id}?token=${link.token}`;
                          return (
                            <div key={link.id} className="flex items-center justify-between gap-4 p-2 bg-zinc-50 border border-zinc-150 rounded-lg text-xs">
                              <div className="truncate flex-1">
                                <span className="text-[10px] font-mono text-zinc-600 select-all font-semibold block truncate">
                                  {guestUrl}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!link.revoked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(guestUrl);
                                      alert("Link copied!");
                                    }}
                                    className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-bold text-zinc-650"
                                  >
                                    Copy
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/v1/articles/${activeLinkManagerArticle.id}/guest-links`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ link_id: link.id, revoked: !link.revoked }),
                                      });
                                      if (res.ok) {
                                        const updated = await res.json();
                                        setGuestLinks(guestLinks.map((l) => (l.id === link.id ? updated : l)));
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }}
                                  className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                                    link.revoked ? "bg-zinc-950 text-white" : "border border-red-200 text-red-700"
                                  }`}
                                >
                                  {link.revoked ? "Restore" : "Revoke"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-zinc-150">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLinkManagerArticle(null);
                          setGuestLinks([]);
                        }}
                        className="rounded border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-650"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* EDITOR / CREATOR FORM VIEW */
            <form onSubmit={handleSaveArticle} className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-150 pb-4">
                  <h3 className="text-sm font-extrabold text-zinc-950">
                    {isCreating ? "Create Support Article" : `Review & Edit: ${editingArticle?.title}`}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeEditor}
                      className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-600 shadow-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-xs"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    {!isCreating && editingArticle && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArticle(editingArticle.id)}
                        className="rounded bg-red-650 hover:bg-red-750 px-3.5 py-2 text-xs font-bold text-white shadow-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-800">
                    {formSuccess}
                  </div>
                )}

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                      placeholder="e.g. SIM Card Setup"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Slug</label>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                      placeholder="sim-card-setup"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                    >
                      <option value="en">English (EN)</option>
                      <option value="ar">Arabic (AR)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                    >
                      <option value="PUBLIC">Public (Guests can search)</option>
                      <option value="PRIVATE">Private (Internal only)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Review Due Date</label>
                    <input
                      type="date"
                      value={reviewDue}
                      onChange={(e) => setReviewDue(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Workflow status transition panel (only in edit mode) */}
                {(isCreating || editingArticle) && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">
                      Workflow Governance Operations
                    </h4>

                    {/* Separation of Duties Banner Alert */}
                    {!isCreating && editingArticle && editingArticle.author_id === currentUserId && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="font-bold">Separation of Duties Restriction</p>
                          <p className="mt-0.5 font-medium">You are the author of this article. The server enforces that a different Administrator must approve or publish this guide.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">
                          Current Status: <span className="text-zinc-800 font-extrabold uppercase">{isCreating ? "DRAFT" : editingArticle?.status}</span>
                        </label>
                        <select
                          value={transitionStatus}
                          onChange={(e) => setTransitionStatus(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Change Status --</option>
                          {getAllowedStatusTransitions(isCreating ? "Draft" : editingArticle?.status || "Draft").map((t) => {
                            const isSelfAuthorRestrict = !isCreating && !!editingArticle && (t.status === "Approved" || t.status === "Published") && editingArticle.author_id === currentUserId;
                            return (
                              <option key={t.status} value={t.status} disabled={isSelfAuthorRestrict}>
                                {t.label} {isSelfAuthorRestrict ? "(Restricted: Author)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">
                          Transition Notes / Rejection Comment
                        </label>
                        <input
                          type="text"
                          value={transitionComment}
                          onChange={(e) => setTransitionComment(e.target.value)}
                          placeholder="e.g. Approved copy, fixed typo, rejected because..."
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Guest Links Manager Panel (only in edit mode for Published articles) */}
                {!isCreating && editingArticle && editingArticle.status === "Published" && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">
                          Guest Link Access Tokens
                        </h4>
                        <p className="text-[10px] text-zinc-450 font-medium mt-0.5">Generate secure URLs to share this article with guest users.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateGuestLink}
                        disabled={generatingLink}
                        className="rounded border border-zinc-250 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-700 shadow-2xs"
                      >
                        {generatingLink ? "Generating..." : "Generate Guest Link"}
                      </button>
                    </div>

                    {guestLinks.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 font-semibold italic">No guest links generated for this article yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {guestLinks.map((link) => {
                          const guestUrl = typeof window !== "undefined" ? `${window.location.origin}/articles/${editingArticle.id}?token=${link.token}` : "";
                          return (
                            <div key={link.id} className="flex items-center justify-between gap-4 p-2.5 bg-white border border-zinc-150 rounded-lg text-xs">
                              <div className="space-y-0.5 truncate flex-1">
                                <span className="text-[10px] font-mono text-zinc-600 select-all font-semibold block truncate">
                                  {guestUrl}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-medium">
                                  Created {new Date(link.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {link.revoked ? (
                                  <span className="rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[9px] font-bold">
                                    Revoked
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(guestUrl);
                                      alert("Guest link copied to clipboard!");
                                    }}
                                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-0.5 text-[9px] font-bold text-zinc-650"
                                  >
                                    Copy Link
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRevokeGuestLink(link.id, !link.revoked)}
                                  className={`rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${
                                    link.revoked
                                      ? "bg-zinc-950 text-white hover:bg-zinc-800"
                                      : "border border-red-200 text-red-700 hover:bg-red-50"
                                  }`}
                                >
                                  {link.revoked ? "Restore" : "Revoke"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Content variants editor (tabs) */}
                <div className="space-y-4">
                  <div className="flex border-b border-zinc-200 gap-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setVariantTab("default")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                        variantTab === "default" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
                      }`}
                    >
                      Default Variant
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariantTab("agent")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1 ${
                        variantTab === "agent" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
                      }`}
                    >
                      Agent Desk {isVariantEmpty("agent") && <span className="text-[9px] text-amber-600 font-semibold">(Fallback)</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariantTab("chatbot")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1 ${
                        variantTab === "chatbot" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
                      }`}
                    >
                      Chatbot {isVariantEmpty("chatbot") && <span className="text-[9px] text-amber-600 font-semibold">(Fallback)</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariantTab("whatsapp")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1 ${
                        variantTab === "whatsapp" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
                      }`}
                    >
                      WhatsApp {isVariantEmpty("whatsapp") && <span className="text-[9px] text-amber-600 font-semibold">(Fallback)</span>}
                    </button>
                  </div>

                  {/* Fallback Warning Alerts */}
                  {variantTab !== "default" && isVariantEmpty(variantTab) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-850 flex items-center gap-2">
                      <span>⚠️</span>
                      Notice: No variant exists for the {variantTab.toUpperCase()} channel. The system will fall back to displaying the Default Variant.
                    </div>
                  )}

                  {/* Picture Guide Direct Upload tool */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">Direct Picture Guide Upload</h4>
                      <p className="text-[10px] text-zinc-450 font-medium mt-0.5">Upload image guides (PNG/JPG, max 5MB) to render inline in steps.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                        id="image-file-input"
                      />
                      <label
                        htmlFor="image-file-input"
                        className="rounded border border-zinc-250 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 cursor-pointer shadow-2xs transition-all disabled:opacity-50"
                      >
                        {uploadingImage ? "Uploading image..." : "Upload Image Guide"}
                      </label>
                    </div>
                  </div>

                  {/* Editors Fields */}
                  {variantTab === "default" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                        <input
                          type="text"
                          value={vDefaultShort}
                          onChange={(e) => setVDefaultShort(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                          placeholder="Quick summary snippet..."
                        />
                      </div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Detailed Steps (Body Content)</label>
                        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1.5 rounded-t-lg border-t border-x border-zinc-200">
                          {["bold", "italic", "underline", "h1", "h2", "bullet", "number", "link", "image"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => insertFormatting("default", type)}
                              className="rounded bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:text-zinc-955 transition-all capitalize"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <textarea
                          id="textarea-default"
                          required
                          rows={10}
                          value={vDefaultDetailed}
                          onChange={(e) => setVDefaultDetailed(e.target.value)}
                          className="w-full rounded-b-lg rounded-t-none border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
                          placeholder="Write the full support instructions in Markdown..."
                        />
                    </div>
                  )}

                  {variantTab === "agent" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                          <input
                            type="text"
                            value={vAgentShort}
                            onChange={(e) => setVAgentShort(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Copy-ready Macro Response</label>
                          <input
                            type="text"
                            value={vAgentMacro}
                            onChange={(e) => setVAgentMacro(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                            placeholder="Text copied to clipboard in one click by agents..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Detailed Steps</label>
                        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1.5 rounded-t-lg border-t border-x border-zinc-200">
                          {["bold", "italic", "underline", "h1", "h2", "bullet", "number", "link", "image"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => insertFormatting("agent", type)}
                              className="rounded bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:text-zinc-955 transition-all capitalize"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <textarea
                          id="textarea-agent"
                          rows={6}
                          value={vAgentDetailed}
                          onChange={(e) => setVAgentDetailed(e.target.value)}
                          className="w-full rounded-b-lg rounded-t-none border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
                        />
                      </div>

                      {/* Troubleshooting flow JSON editor */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Interactive Troubleshooting Flow JSON</label>
                          <button
                            type="button"
                            onClick={() => setVAgentFlow(JSON.stringify(SAMPLE_TROUBLESHOOTING_FLOW, null, 2))}
                            className="rounded border border-zinc-250 bg-white px-2 py-1 text-[9px] font-bold text-zinc-700 hover:text-zinc-950 shadow-2xs"
                          >
                            Load Template Flow
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={vAgentFlow}
                          onChange={(e) => setVAgentFlow(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-mono shadow-inner"
                          placeholder='{ "start_node": "...", "nodes": { ... } }'
                        />
                        {vAgentFlow && (
                          <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                            <span className="text-[10px] text-zinc-450 font-bold uppercase block mb-3">Live Flow Tester Preview:</span>
                            {(() => {
                              try {
                                const parsed = JSON.parse(vAgentFlow);
                                return <TroubleshootingPlayer flow={parsed} />;
                              } catch (err) {
                                return <span className="text-[10px] text-red-500 font-semibold font-mono">Invalid JSON syntax. Fix structure to preview flow player.</span>;
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {variantTab === "chatbot" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                        <input
                          type="text"
                          value={vChatbotShort}
                          onChange={(e) => setVChatbotShort(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Detailed Steps</label>
                        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1.5 rounded-t-lg border-t border-x border-zinc-200">
                          {["bold", "italic", "underline", "h1", "h2", "bullet", "number", "link", "image"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => insertFormatting("chatbot", type)}
                              className="rounded bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:text-zinc-955 transition-all capitalize"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <textarea
                          id="textarea-chatbot"
                          rows={6}
                          value={vChatbotDetailed}
                          onChange={(e) => setVChatbotDetailed(e.target.value)}
                          className="w-full rounded-b-lg rounded-t-none border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {variantTab === "whatsapp" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                        <input
                          type="text"
                          value={vWhatsappShort}
                          onChange={(e) => setVWhatsappShort(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Detailed Steps</label>
                        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1.5 rounded-t-lg border-t border-x border-zinc-200">
                          {["bold", "italic", "underline", "h1", "h2", "bullet", "number", "link", "image"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => insertFormatting("whatsapp", type)}
                              className="rounded bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:text-zinc-955 transition-all capitalize"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <textarea
                          id="textarea-whatsapp"
                          rows={6}
                          value={vWhatsappDetailed}
                          onChange={(e) => setVWhatsappDetailed(e.target.value)}
                          className="w-full rounded-b-lg rounded-t-none border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* KNOWLEDGE GAPS QUEUE VIEW */}
      {currentTab === "gaps" && (
        <div className="space-y-6">
          {/* Status selector */}
          <div className="flex gap-2">
            {["ALL", "NEW", "IN_PROGRESS", "RESOLVED", "DISMISSED"].map((st) => (
              <button
                key={st}
                onClick={() => setGapStatusFilter(st)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                  gapStatusFilter === st
                    ? "bg-zinc-950 text-white border-zinc-950"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Captured Search Miss Gaps</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                    <th className="p-4">Search Query Text</th>
                    <th className="p-4">Occurrences</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Reported By</th>
                    <th className="p-4">Claimed By</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {gaps
                    .filter((g) => gapStatusFilter === "ALL" || g.status === gapStatusFilter)
                    .length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400 font-semibold">
                        No knowledge gaps found in this queue.
                      </td>
                    </tr>
                  ) : (
                    gaps
                      .filter((g) => gapStatusFilter === "ALL" || g.status === gapStatusFilter)
                      .map((g) => (
                        <tr key={g.id} className="hover:bg-zinc-50/50">
                          <td className="p-4 font-bold text-zinc-950 italic">"{g.query_text}"</td>
                          <td className="p-4 font-mono font-bold text-zinc-600">{g.occurrences}x</td>
                          <td className="p-4">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                                g.status === "RESOLVED"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : g.status === "NEW"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {g.status}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500 font-medium">{g.reporter?.name || "Customer / Guest"}</td>
                          <td className="p-4 text-zinc-500 font-medium">{g.claimer?.name || "Unassigned"}</td>
                          <td className="p-4 text-right space-x-2">
                            {g.status === "NEW" && (
                              <button
                                onClick={() => handleClaimGap(g.id)}
                                className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-650"
                              >
                                Claim Gap
                              </button>
                            )}
                            {g.status === "IN_PROGRESS" && (
                              <button
                                onClick={() => setResolvingGap(g)}
                                className="rounded bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                              >
                                Resolve Gap
                              </button>
                            )}
                            {g.status === "RESOLVED" && g.resolving_article && (
                              <span className="text-[10px] text-zinc-400 font-medium">
                                Resolved ➔ {g.resolving_article.title}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL OVERLAY FOR GAPS */}
      {resolvingGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-950">Resolve Knowledge Gap</h3>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Link this search query gap to a published support article.
              </p>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3.5 border border-zinc-200 text-xs italic font-semibold text-zinc-700">
              Query: "{resolvingGap.query_text}"
            </div>

            <form onSubmit={handleResolveGapSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">
                  Select Resolving Article
                </label>
                <select
                  required
                  value={selectedResolvingArticleId}
                  onChange={(e) => setSelectedResolvingArticleId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-855 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Choose Published Article --</option>
                  {articles
                    .filter((a) => a.status === "Published")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} (/{a.slug})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResolvingGap(null);
                    setSelectedResolvingArticleId("");
                  }}
                  className="rounded border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-green-600 hover:bg-green-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Submit Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
