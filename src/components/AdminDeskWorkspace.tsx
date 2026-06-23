"use client";

import { useState, useEffect } from "react";
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
      options: [
        { text: "Yes, it works now", next: "resolve_clean" },
        { text: "No, it still says Invalid SIM", next: "escalate_replace" }
      ]
    },
    resolve_clean: {
      text: "Issue resolved by cleaning SIM card copper chip.",
      is_terminal: true,
      outcome: "resolve"
    },
    resolve_carrier: {
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
}: WorkspaceProps) {
  const [articles, setArticles] = useState<AdminArticle[]>(initialArticles);
  const [gaps, setGaps] = useState<Gap[]>(initialGaps);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"articles" | "gaps" | "audit">("articles");

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
        const putRes = await fetch(`/api/v1/articles/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variants: variantsPayload,
          }),
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

  return (
    <div className="space-y-6 text-left">
      {/* Sub-navigation bar */}
      <div className="flex border-b border-zinc-200 gap-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("articles");
            closeEditor();
          }}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "articles" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
          }`}
        >
          Articles Manager
        </button>
        <button
          onClick={() => {
            setActiveTab("gaps");
            closeEditor();
          }}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "gaps" ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-400"
          }`}
        >
          Gaps Queue
        </button>
      </div>

      {/* ARTICLES MANAGER VIEW */}
      {activeTab === "articles" && (
        <div className="space-y-6">
          {!editingArticle && !isCreating ? (
            /* Table list view */
            <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-zinc-200 bg-zinc-50/50 p-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Articles Queue</h3>
                <button
                  onClick={openCreator}
                  className="rounded bg-zinc-950 hover:bg-zinc-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                >
                  Create Article
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                      <th className="p-4">Title</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Language</th>
                      <th className="p-4">Author</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150">
                    {articles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-400 font-semibold">
                          No articles found in this tenant organization.
                        </td>
                      </tr>
                    ) : (
                      articles.map((art) => (
                        <tr key={art.id} className="hover:bg-zinc-50/50">
                          <td className="p-4 font-bold text-zinc-950">
                            {art.title}
                            <code className="block mt-0.5 font-mono text-[9px] font-medium text-zinc-400">
                              /{art.slug}
                            </code>
                          </td>
                          <td className="p-4">{art.category?.name || "General"}</td>
                          <td className="p-4">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                                art.status === "Published"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : art.status === "Draft"
                                  ? "bg-zinc-100 text-zinc-650 border-zinc-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {art.status}
                            </span>
                          </td>
                          <td className="p-4 uppercase">{art.language}</td>
                          <td className="p-4">{art.author?.name || "System"}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => openEditor(art)}
                              className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-650"
                            >
                              Edit / Review
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                {!isCreating && editingArticle && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455">
                      Workflow Governance Operations
                    </h4>

                    {/* Separation of Duties Banner Alert */}
                    {editingArticle.author_id === currentUserId && (
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
                          Current Status: <span className="text-zinc-800 font-extrabold uppercase">{editingArticle.status}</span>
                        </label>
                        <select
                          value={transitionStatus}
                          onChange={(e) => setTransitionStatus(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Change Status --</option>
                          {getAllowedStatusTransitions(editingArticle.status).map((t) => {
                            const isSelfAuthorRestrict = (t.status === "Approved" || t.status === "Published") && editingArticle.author_id === currentUserId;
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Detailed Steps (Body Content)</label>
                        <textarea
                          required
                          rows={10}
                          value={vDefaultDetailed}
                          onChange={(e) => setVDefaultDetailed(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
                          placeholder="Write the full support instructions in Markdown..."
                        />
                      </div>
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
                        <textarea
                          rows={6}
                          value={vAgentDetailed}
                          onChange={(e) => setVAgentDetailed(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
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
                        <textarea
                          rows={6}
                          value={vChatbotDetailed}
                          onChange={(e) => setVChatbotDetailed(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
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
                        <textarea
                          rows={6}
                          value={vWhatsappDetailed}
                          onChange={(e) => setVWhatsappDetailed(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-850 focus:outline-hidden font-medium"
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
      {activeTab === "gaps" && (
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
  );
}
