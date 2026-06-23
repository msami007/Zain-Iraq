"use client";

import { useState, useEffect, useRef } from "react";
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
  status_history?: any[];
  article_teams?: { team: { id: string; name: string } }[];
  created_at?: string;
  published_at?: string | null;
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
  overrideActiveTab?: "articles" | "gaps" | "audit" | "workflows";
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
  const [activeTab, setActiveTab] = useState<"articles" | "gaps" | "audit" | "workflows" | "analytics">("articles");

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
  const [fullArticleDetail, setFullArticleDetail] = useState<any | null>(null);
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

  // Variant fields: short answers are used for summaries across channels
  const [vDefaultShort, setVDefaultShort] = useState(""); // Default variant summary description
  const [vDefaultDetailed, setVDefaultDetailed] = useState("");

  const [vAgentShort, setVAgentShort] = useState(""); // Agent variant summary description
  const [vAgentDetailed, setVAgentDetailed] = useState("");
  const [vAgentMacro, setVAgentMacro] = useState("");
  const [vAgentFlow, setVAgentFlow] = useState("");

  const [vChatbotShort, setVChatbotShort] = useState(""); // Chatbot variant summary description
  const [vChatbotDetailed, setVChatbotDetailed] = useState("");

  const [vWhatsappShort, setVWhatsappShort] = useState(""); // WhatsApp variant summary description
  const [vWhatsappDetailed, setVWhatsappDetailed] = useState("");

  // Initial values for WYSIWYG editors (loaded once when editing article changes)
  const [initialDefaultDetailed, setInitialDefaultDetailed] = useState("");
  const [initialAgentDetailed, setInitialAgentDetailed] = useState("");
  const [initialChatbotDetailed, setInitialChatbotDetailed] = useState("");
  const [initialWhatsappDetailed, setInitialWhatsappDetailed] = useState("");

  // Refs for WYSIWYG editors
  const editorRefDefault = useRef<HTMLDivElement>(null);
  const editorRefAgent = useRef<HTMLDivElement>(null);
  const editorRefChatbot = useRef<HTMLDivElement>(null);
  const editorRefWhatsapp = useRef<HTMLDivElement>(null);

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);

  // Guest Links State
  const [guestLinks, setGuestLinks] = useState<any[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Teams state and fetch
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isTeamsDropdownOpen, setIsTeamsDropdownOpen] = useState(false);

  // Rejection modal states
  const [rejectionModalArticleId, setRejectionModalArticleId] = useState<string | null>(null);
  const [rejectionModalComment, setRejectionModalComment] = useState("");

  // Origin Gap tracking for creation
  const [originGapId, setOriginGapId] = useState<string | null>(null);

  // Date filtering state for Gaps
  const [gapStartDate, setGapStartDate] = useState("");
  const [gapEndDate, setGapEndDate] = useState("");

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const url = currentUserRole === "SuperAdmin" 
          ? "/api/v1/teams" 
          : `/api/v1/teams?tenant_id=${tenantId}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setTeams(data);
        }
      } catch (err) {
        console.error("Failed to load teams", err);
      }
    };
    fetchTeams();
  }, [tenantId, currentUserRole]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/v1/analytics?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchFilteredGaps = async () => {
    try {
      let url = `/api/v1/gaps?status=${gapStatusFilter === "ALL" ? "" : gapStatusFilter}`;
      if (gapStartDate) {
        url += `&startDate=${gapStartDate}`;
      }
      if (gapEndDate) {
        url += `&endDate=${gapEndDate}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGaps(data);
      }
    } catch (err) {
      console.error("Failed to fetch gaps", err);
    }
  };

  useEffect(() => {
    if (activeTab === "gaps") {
      fetchFilteredGaps();
    }
  }, [gapStatusFilter, gapStartDate, gapEndDate, activeTab]);

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



  // Fetch Audit Logs and Analytics when tab changes
  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    } else if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [activeTab]);

  // Load visual editor initial HTML contents when editing article changes (uncontrolled editor initialization)
  useEffect(() => {
    if (editorRefDefault.current) {
      editorRefDefault.current.innerHTML = initialDefaultDetailed;
    }
  }, [initialDefaultDetailed]);

  useEffect(() => {
    if (editorRefAgent.current) {
      editorRefAgent.current.innerHTML = initialAgentDetailed;
    }
  }, [initialAgentDetailed]);

  useEffect(() => {
    if (editorRefChatbot.current) {
      editorRefChatbot.current.innerHTML = initialChatbotDetailed;
    }
  }, [initialChatbotDetailed]);

  useEffect(() => {
    if (editorRefWhatsapp.current) {
      editorRefWhatsapp.current.innerHTML = initialWhatsappDetailed;
    }
  }, [initialWhatsappDetailed]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`/api/v1/audit?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
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



  const executeCommand = (command: string, value: string = "") => {
    // 1. Restore focus to the active editor ref before executing the command
    const activeEditor =
      variantTab === "default" ? editorRefDefault.current :
        variantTab === "agent" ? editorRefAgent.current :
          variantTab === "chatbot" ? editorRefChatbot.current :
            editorRefWhatsapp.current;

    if (activeEditor) {
      activeEditor.focus();
    }

    // 2. Execute the document command
    if (command === "fontSize") {
      const sizeMap: Record<string, string> = {
        "12": "2",
        "14": "3",
        "16": "4",
        "18": "5",
        "20": "6"
      };
      document.execCommand(command, false, sizeMap[value] || "4");
    } else if (command === "createLink") {
      const url = prompt("Enter URL:", "https://");
      if (url) {
        document.execCommand(command, false, url);
      }
    } else if (command === "insertImage") {
      const url = prompt("Enter Image URL:", "https://");
      if (url) {
        document.execCommand(command, false, url);
      }
    } else if (command === "insertTable") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement("div");
        el.innerHTML = `<table style="width:100%; border-collapse:collapse; border:1px solid #e4e4e7; margin:10px 0;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="border:1px solid #e4e4e7; padding:8px; text-align:left;">Header 1</th>
              <th style="border:1px solid #e4e4e7; padding:8px; text-align:left;">Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #e4e4e7; padding:8px;">Cell 1</td>
              <td style="border:1px solid #e4e4e7; padding:8px;">Cell 2</td>
            </tr>
          </tbody>
        </table>`;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
      }
    } else if (command === "clearFormatting") {
      document.execCommand("removeFormat", false);
    } else {
      document.execCommand(command, false, value);
    }

    // 3. Manually trigger state update from visual innerHTML contents
    if (activeEditor) {
      const newHTML = activeEditor.innerHTML;
      if (variantTab === "default") setVDefaultDetailed(newHTML);
      else if (variantTab === "agent") setVAgentDetailed(newHTML);
      else if (variantTab === "chatbot") setVChatbotDetailed(newHTML);
      else if (variantTab === "whatsapp") setVWhatsappDetailed(newHTML);
    }
  };

  const handleDirectStatusTransition = async (articleId: string, targetStatus: string, customComment?: string) => {
    try {
      const art = articles.find(a => a.id === articleId);
      if (!art) return;

      // Separation of duties check
      if ((targetStatus === "Approved" || targetStatus === "Published") && art.author_id === currentUserId) {
        alert("Separation of duties restriction: You are the author of this article and cannot approve or publish it.");
        return;
      }

      if (targetStatus === "Draft" && !customComment) {
        setRejectionModalArticleId(articleId);
        setRejectionModalComment("");
        return;
      }

      const res = await fetch(`/api/v1/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          comment: customComment || `Direct status transition to ${targetStatus} from dashboard`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to transition article to ${targetStatus}`);
      }

      const updated = await res.json();
      setArticles(articles.map((a) => (a.id === updated.id ? updated : a)));
      alert(`Article transitioned to ${targetStatus} successfully.`);
      
      // Clear rejection modal if open
      setRejectionModalArticleId(null);
      setRejectionModalComment("");
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

      // Insert image visually into the active editor
      const imgHtml = `<img src="${imageUrl}" alt="Uploaded Image" style="max-width:100%; height:auto; margin:10px 0; border-radius:8px; border:1px solid #e4e4e7;" />`;

      const activeEditor =
        variantTab === "default" ? editorRefDefault.current :
          variantTab === "agent" ? editorRefAgent.current :
            variantTab === "chatbot" ? editorRefChatbot.current :
              editorRefWhatsapp.current;

      if (activeEditor) {
        activeEditor.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = imgHtml;
          const node = tempDiv.firstChild;
          if (node) {
            range.insertNode(node);
            range.collapse(false);
          }
        } else {
          // Fallback if no selection
          activeEditor.innerHTML += imgHtml;
        }

        // Update state
        const newHTML = activeEditor.innerHTML;
        if (variantTab === "default") setVDefaultDetailed(newHTML);
        else if (variantTab === "agent") setVAgentDetailed(newHTML);
        else if (variantTab === "chatbot") setVChatbotDetailed(newHTML);
        else if (variantTab === "whatsapp") setVWhatsappDetailed(newHTML);
      }

      alert("Image uploaded successfully and link inserted!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const openEditor = async (article: AdminArticle) => {
    setEditingArticle(article);
    setFullArticleDetail(null);
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
    const defaultVal = dV?.detailed_steps || "";
    setVDefaultShort(dV?.short_answer || "");
    setVDefaultDetailed(defaultVal);
    setInitialDefaultDetailed(defaultVal);

    const aV = article.variants?.find((v) => v.channel === "agent");
    const agentVal = aV?.detailed_steps || "";
    setVAgentShort(aV?.short_answer || "");
    setVAgentDetailed(agentVal);
    setInitialAgentDetailed(agentVal);
    setVAgentMacro(aV?.copy_ready_macro || "");
    setVAgentFlow(aV?.troubleshooting_flow ? JSON.stringify(aV.troubleshooting_flow, null, 2) : "");

    const cV = article.variants?.find((v) => v.channel === "chatbot");
    const chatbotVal = cV?.detailed_steps || "";
    setVChatbotShort(cV?.short_answer || "");
    setVChatbotDetailed(chatbotVal);
    setInitialChatbotDetailed(chatbotVal);

    const wV = article.variants?.find((v) => v.channel === "whatsapp");
    const whatsappVal = wV?.detailed_steps || "";
    setVWhatsappShort(wV?.short_answer || "");
    setVWhatsappDetailed(whatsappVal);
    setInitialWhatsappDetailed(whatsappVal);

    // Load assigned teams
    setSelectedTeams(article.article_teams?.map((at: any) => at.team.id) || []);
    setIsTeamsDropdownOpen(false);

    try {
      const res = await fetch(`/api/v1/articles/${article.id}`);
      if (res.ok) {
        const fullDetail = await res.json();
        setFullArticleDetail(fullDetail);
        if (fullDetail.article_teams) {
          setSelectedTeams(fullDetail.article_teams.map((at: any) => at.team.id));
        }
      }
    } catch (e) {
      console.error("Error fetching article details:", e);
    }
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
    setSelectedTeams([]);
    setIsTeamsDropdownOpen(false);

    setVDefaultShort("");
    setVDefaultDetailed("");
    setInitialDefaultDetailed("");
    setVAgentShort("");
    setVAgentDetailed("");
    setInitialAgentDetailed("");
    setVAgentMacro("");
    setVAgentFlow("");
    setVChatbotShort("");
    setVChatbotDetailed("");
    setInitialChatbotDetailed("");
    setVWhatsappShort("");
    setVWhatsappDetailed("");
    setInitialWhatsappDetailed("");
  };

  const closeEditor = () => {
    setEditingArticle(null);
    setIsCreating(false);
    setTransitionStatus("");
    setTransitionComment("");
    setIsTeamsDropdownOpen(false);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultDetailedTextClean = vDefaultDetailed.replace(/<[^>]*>/g, "").trim();
    if (!title || !slug || !categoryId || !defaultDetailedTextClean) {
      setFormError("Title, Slug, Category, and Default Detailed Steps are required.");
      return;
    }

    if (selectedTeams.length === 0) {
      setFormError("At least one team must be assigned to the article.");
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
            team_ids: selectedTeams,
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
          team_ids: selectedTeams,
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

        if (originGapId) {
          try {
            const resResolve = await fetch("/api/v1/gaps", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: originGapId,
                status: "RESOLVED",
                resolving_article_id: finalArticle.id,
              }),
            });
            if (resResolve.ok) {
              const updatedGap = await resResolve.json();
              setGaps(gaps.map((g) => (g.id === originGapId ? updatedGap : g)));
            }
          } catch (e) {
            console.error("Failed to automatically resolve gap:", e);
          }
          setOriginGapId(null);
        }

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
          team_ids: selectedTeams,
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

  const handleUnresolveGap = async (gapId: string) => {
    try {
      const res = await fetch("/api/v1/gaps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gapId, status: "IN_PROGRESS" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to unresolve gap");
      }
      const updated = await res.json();
      setGaps(gaps.map((g) => (g.id === gapId ? updated : g)));
      alert("Gap unresolved/rolled back successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateArticleFromGap = (gap: Gap) => {
    openCreator();
    setTitle(gap.query_text);
    setSlug(gap.query_text.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
    setOriginGapId(gap.id);
    setActiveTab("articles");
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
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${currentTab === "articles" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
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
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${currentTab === "gaps" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                  }`}
              >
                <span>🔍</span> Gaps Queue
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("workflows");
                  closeEditor();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${currentTab === "workflows" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                  }`}
              >
                <span>🔄</span> Workflows
                {articles.filter(a => a.status === "InReview" || a.status === "Approved").length > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/20">
                    {articles.filter(a => a.status === "InReview" || a.status === "Approved").length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("audit");
                  closeEditor();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${currentTab === "audit" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                  }`}
              >
                <span>📋</span> Audit Logs
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("analytics");
                  closeEditor();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${currentTab === "analytics" ? "bg-zinc-900 text-white shadow-2xs" : "hover:bg-zinc-900/40 hover:text-zinc-200"
                  }`}
              >
                <span>📊</span> Analytics
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
            <button
              type="button"
              onClick={async () => {
                await signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-transparent hover:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-all shadow-xs"
            >
              Sign Out
            </button>
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
                {currentTab === "articles" ? "Articles Manager" : currentTab === "gaps" ? "Gaps Queue" : currentTab === "workflows" ? "Workflows" : currentTab === "audit" ? "Audit Logs" : "Analytics"}
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
                          className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${selectedStatusFilter === tab
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
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${art.status === "Published"
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
                                      className={`rounded px-2 py-0.5 text-[9px] font-bold ${link.revoked ? "bg-zinc-950 text-white" : "border border-red-200 text-red-700"
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

                    {/* Rejection Feedback Amber Alert Box */}
                    {!isCreating && editingArticle && editingArticle.status === "Draft" && fullArticleDetail?.status_history && (
                      (() => {
                        const rejection = fullArticleDetail.status_history.find((h: any) => h.to_status === "Draft" && h.comment);
                        if (rejection) {
                          return (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5 shadow-2xs">
                              <span className="text-base">⚠️</span>
                              <div className="space-y-1">
                                <p className="font-bold">Rejection Feedback</p>
                                <p className="italic font-semibold font-mono text-[11px] bg-white/60 p-2 rounded-md border border-amber-100">"{rejection.comment}"</p>
                                <p className="text-[10px] text-amber-700/80">Rejected by <span className="font-bold">{rejection.actor?.name}</span> on {new Date(rejection.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}

                    {/* Governance Metadata Badge Bar / Info Box */}
                    {!isCreating && editingArticle && (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-455">
                          Governance Metadata
                        </h4>
                        {fullArticleDetail ? (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                            <div>
                              <span className="text-[10px] text-zinc-450 block font-medium">Written By</span>
                              <span className="font-semibold text-zinc-800">{fullArticleDetail.author?.name || "Unknown"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-450 block font-medium">Approved By</span>
                              <span className="font-semibold text-zinc-800">
                                {fullArticleDetail.status_history?.find((h: any) => h.to_status === "Approved")?.actor?.name || 
                                 (fullArticleDetail.status === "Published" ? fullArticleDetail.status_history?.find((h: any) => h.to_status === "Published")?.actor?.name : null) || 
                                 "Pending Approval"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-450 block font-medium">Published By</span>
                              <span className="font-semibold text-zinc-800">
                                {fullArticleDetail.status_history?.find((h: any) => h.to_status === "Published")?.actor?.name || "Not Published"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-450 block font-medium">Created Date</span>
                              <span className="font-semibold text-zinc-800">{new Date(fullArticleDetail.created_at).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-450 block font-medium">Published Date</span>
                              <span className="font-semibold text-zinc-800">
                                {fullArticleDetail.published_at ? new Date(fullArticleDetail.published_at).toLocaleDateString() : "Not Published"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-455 animate-pulse">Loading governance metadata...</div>
                        )}
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

                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Assign to Teams</label>
                        <button
                          type="button"
                          onClick={() => setIsTeamsDropdownOpen(!isTeamsDropdownOpen)}
                          className="flex items-center justify-between w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-850 hover:bg-zinc-50 transition-colors text-left"
                        >
                          <span className="truncate">
                            {selectedTeams.length === 0
                              ? "Select Teams..."
                              : teams
                                  .filter(t => selectedTeams.includes(t.id))
                                  .map(t => t.name)
                                  .join(", ")}
                          </span>
                          <svg className="h-4 w-4 text-zinc-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isTeamsDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsTeamsDropdownOpen(false)} />
                            <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 text-left shadow-md max-h-40 overflow-y-auto space-y-1">
                              {teams
                                .filter((team) => {
                                  if (currentUserRole === "Admin") {
                                    return team.user_teams?.some((ut: any) => ut.user_id === currentUserId);
                                  }
                                  return true;
                                })
                                .map((team) => (
                                  <label key={team.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-700 hover:bg-zinc-50 p-2 rounded transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={selectedTeams.includes(team.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTeams([...selectedTeams, team.id]);
                                        } else {
                                          setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                        }
                                      }}
                                      className="accent-zinc-955"
                                    />
                                    <span className="truncate">{team.name}</span>
                                  </label>
                                ))}
                            </div>
                          </>
                        )}
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
                                      className={`rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${link.revoked
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
                      {/* Variant Selection Tabs */}
                      <div className="flex border-b border-zinc-200 pb-2 mb-4 gap-2 overflow-x-auto text-left">
                        {[
                          { id: "default", label: "Default Variant", icon: "🌐" },
                          { id: "agent", label: "Agent Desk", icon: "👥" },
                          { id: "chatbot", label: "Chatbot", icon: "🤖" },
                          { id: "whatsapp", label: "WhatsApp", icon: "💬" }
                        ].map((tab) => {
                          const isActive = variantTab === tab.id;
                          const isEmpty = isVariantEmpty(tab.id);
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setVariantTab(tab.id as any)}
                              className={`rounded-lg py-2 px-4 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${isActive
                                  ? "text-white shadow-xs"
                                  : "text-zinc-500 bg-white border-zinc-200 hover:text-zinc-950 hover:bg-zinc-50"
                                }`}
                              style={isActive ? { backgroundColor: brandingColor, borderColor: brandingColor } : {}}
                            >
                              <span>{tab.icon}</span>
                              <span>{tab.label}</span>
                              {tab.id !== "default" && isEmpty && (
                                <span className="text-[8px] uppercase tracking-wider text-amber-600 font-extrabold ml-1">(Fallback)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Fallback Warning Alerts */}
                      {variantTab !== "default" && isVariantEmpty(variantTab) && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-850 flex items-center gap-2 mb-4 text-left">
                          <span>⚠️</span>
                          Notice: No variant exists for the {variantTab.toUpperCase()} channel. The system will fall back to displaying the Default Variant.
                        </div>
                      )}

                      {/* Variant Specific Fields */}
                      {variantTab === "default" && (
                        <div className="space-y-1.5 text-left mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                          <input
                            type="text"
                            value={vDefaultShort}
                            onChange={(e) => setVDefaultShort(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-850 focus:outline-hidden"
                            placeholder="Quick summary snippet..."
                          />
                          <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used for general search previews and fallback channels.</p>
                        </div>
                      )}

                      {variantTab === "agent" && (
                        <div className="space-y-4 mb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-left">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                              <input
                                type="text"
                                value={vAgentShort}
                                onChange={(e) => setVAgentShort(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-850 focus:outline-hidden"
                                placeholder="Agent specific summary..."
                              />
                              <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Shown directly to agents in their active console.</p>
                            </div>
                            <div className="space-y-1.5 text-left">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Copy-ready Macro Response</label>
                              <input
                                type="text"
                                value={vAgentMacro}
                                onChange={(e) => setVAgentMacro(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-850 focus:outline-hidden"
                                placeholder="Text copied to clipboard in one click by agents..."
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {variantTab === "chatbot" && (
                        <div className="space-y-1.5 text-left mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                          <input
                            type="text"
                            value={vChatbotShort}
                            onChange={(e) => setVChatbotShort(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-850 focus:outline-hidden"
                            placeholder="Chatbot specific summary..."
                          />
                          <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used by the AI bot to answer user search queries.</p>
                        </div>
                      )}

                      {variantTab === "whatsapp" && (
                        <div className="space-y-1.5 text-left mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short Summary</label>
                          <input
                            type="text"
                            value={vWhatsappShort}
                            onChange={(e) => setVWhatsappShort(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-850 focus:outline-hidden"
                            placeholder="WhatsApp specific summary..."
                          />
                          <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Optimized text for WhatsApp channel delivery.</p>
                        </div>
                      )}

                      {/* Redesigned Premium Editor Container */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block text-left">Detailed Steps</label>
                        <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                          {/* Floating Formatting Toolbar */}
                          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-50/50 p-2.5 border-b border-zinc-200 text-left">
                            {/* Undo / Redo */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand('undo')}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-200 shadow-2xs"
                              title="Undo"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand('redo')}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-200 shadow-2xs"
                              title="Redo"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-22l-6 6m6-6l-6-6" />
                              </svg>
                            </button>

                            <div className="h-5 w-px bg-zinc-200 mx-1" />

                            {/* Text Style Dropdown */}
                            <select
                              onChange={(e) => executeCommand("formatBlock", e.target.value === "paragraph" ? "<p>" : `<${e.target.value}>`)}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-655 cursor-pointer focus:outline-hidden"
                              defaultValue="paragraph"
                            >
                              <option value="paragraph">Normal text</option>
                              <option value="h1">Heading 1</option>
                              <option value="h2">Heading 2</option>
                              <option value="h3">Heading 3</option>
                            </select>

                            {/* Font Size Dropdown */}
                            <select
                              onChange={(e) => executeCommand("fontSize", e.target.value)}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-655 cursor-pointer focus:outline-hidden"
                              defaultValue="16"
                            >
                              <option value="12">12</option>
                              <option value="14">14</option>
                              <option value="16">16</option>
                              <option value="18">18</option>
                              <option value="20">20</option>
                            </select>

                            <div className="h-5 w-px bg-zinc-200 mx-1" />

                            {/* Bold, Italic, Underline, Strikethrough */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("bold")}
                              className="w-8 h-8 flex items-center justify-center text-xs font-black text-zinc-650 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("italic")}
                              className="w-8 h-8 flex items-center justify-center text-xs italic text-zinc-650 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("underline")}
                              className="w-8 h-8 flex items-center justify-center text-xs underline text-zinc-650 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Underline"
                            >
                              U
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("strikeThrough")}
                              className="w-8 h-8 flex items-center justify-center text-xs line-through text-zinc-650 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Strikethrough"
                            >
                              S
                            </button>

                            {/* Text Color / Highlight */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const color = prompt("Enter text color (e.g. red, #ef4444):", "#ef4444");
                                if (color) executeCommand("foreColor", color);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-xs text-zinc-655 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs gap-0.5 font-bold"
                              title="Text Color"
                            >
                              <span>T</span>
                              <span className="text-[10px] text-red-500 font-bold">●</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const color = prompt("Enter highlight color (e.g. yellow, #fef08a):", "#fef08a");
                                if (color) executeCommand("backColor", color);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-xs text-zinc-655 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Highlight Color"
                            >
                              ✏️
                            </button>

                            <div className="h-5 w-px bg-zinc-200 mx-1" />

                            {/* Alignments */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("justifyLeft")}
                              className="p-1.5 text-zinc-550 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 cursor-pointer"
                              title="Align Left"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("justifyCenter")}
                              className="p-1.5 text-zinc-550 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 cursor-pointer"
                              title="Align Center"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M5 18h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("justifyRight")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Align Right"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M6 18h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("justifyFull")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Justify"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                            </button>

                            <div className="h-5 w-px bg-zinc-200 mx-1" />

                            {/* Lists & Indents */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("insertUnorderedList")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Bullet List"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("insertOrderedList")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Numbered List"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h13M7 12h13M7 16h13M3 8h.01M3 12h.01M3 16h.01" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("outdent")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Decrease Indent"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l-7-7 7-7m5 14l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("indent")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Increase Indent"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                              </svg>
                            </button>

                            <div className="h-5 w-px bg-zinc-200 mx-1" />

                            {/* Link, Image, Table, HR, Clear */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("createLink")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Insert Link"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => document.getElementById("image-file-input")?.click()}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Upload Image Guide"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("insertTable")}
                              className="p-1.5 text-zinc-555 hover:text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                              title="Insert Table"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("insertHorizontalRule")}
                              className="w-8 h-8 flex items-center justify-center text-xs font-bold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Insert Horizontal Rule"
                            >
                              —
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => executeCommand("clearFormatting")}
                              className="w-8 h-8 flex items-center justify-center text-xs font-bold text-zinc-655 hover:bg-zinc-50 hover:text-zinc-955 rounded-lg border border-zinc-200 cursor-pointer shadow-2xs font-bold"
                              title="Clear Formatting"
                            >
                              Tx
                            </button>
                          </div>

                          {/* Content WYSIWYG Editors */}
                          <div className="relative text-left">
                            <style>{`
                          .wysiwyg-editor {
                            min-height: 350px;
                            outline: none;
                            position: relative;
                            padding: 16px;
                            line-height: 1.625;
                            font-size: 0.875rem;
                            color: #18181b;
                            text-align: left;
                          }
                          .wysiwyg-editor:empty:before {
                            content: attr(data-placeholder);
                            color: #a1a1aa;
                            cursor: text;
                            position: absolute;
                            left: 16px;
                            top: 16px;
                          }
                          .wysiwyg-editor table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 12px 0;
                          }
                          .wysiwyg-editor table td, .wysiwyg-editor table th {
                            border: 1px solid #e4e4e7;
                            padding: 8px;
                          }
                          .wysiwyg-editor ul {
                            list-style-type: disc;
                            padding-left: 20px;
                            margin: 8px 0;
                          }
                          .wysiwyg-editor ol {
                            list-style-type: decimal;
                            padding-left: 20px;
                            margin: 8px 0;
                          }
                          .wysiwyg-editor blockquote {
                            border-left: 4px solid #e4e4e7;
                            padding-left: 16px;
                            margin: 12px 0;
                            color: #71717a;
                            font-style: italic;
                          }
                          .wysiwyg-editor h1 {
                            font-size: 1.5rem;
                            font-weight: 850;
                            margin-top: 16px;
                            margin-bottom: 8px;
                            color: #09090b;
                          }
                          .wysiwyg-editor h2 {
                            font-size: 1.25rem;
                            font-weight: 800;
                            margin-top: 14px;
                            margin-bottom: 6px;
                            color: #09090b;
                          }
                          .wysiwyg-editor h3 {
                            font-size: 1.1rem;
                            font-weight: 750;
                            margin-top: 12px;
                            margin-bottom: 4px;
                            color: #09090b;
                          }
                        `}</style>

                            {/* Editor Default */}
                            <div
                              ref={editorRefDefault}
                              contentEditable={true}
                              onInput={(e) => setVDefaultDetailed(e.currentTarget.innerHTML)}
                              className={`wysiwyg-editor bg-white ${variantTab === "default" ? "block" : "hidden"}`}
                              data-placeholder="Start writing..."
                              suppressContentEditableWarning={true}
                            />

                            {/* Editor Agent */}
                            <div
                              ref={editorRefAgent}
                              contentEditable={true}
                              onInput={(e) => setVAgentDetailed(e.currentTarget.innerHTML)}
                              className={`wysiwyg-editor bg-white ${variantTab === "agent" ? "block" : "hidden"}`}
                              data-placeholder="Start writing..."
                              suppressContentEditableWarning={true}
                            />

                            {/* Editor Chatbot */}
                            <div
                              ref={editorRefChatbot}
                              contentEditable={true}
                              onInput={(e) => setVChatbotDetailed(e.currentTarget.innerHTML)}
                              className={`wysiwyg-editor bg-white ${variantTab === "chatbot" ? "block" : "hidden"}`}
                              data-placeholder="Start writing..."
                              suppressContentEditableWarning={true}
                            />

                            {/* Editor WhatsApp */}
                            <div
                              ref={editorRefWhatsapp}
                              contentEditable={true}
                              onInput={(e) => setVWhatsappDetailed(e.currentTarget.innerHTML)}
                              className={`wysiwyg-editor bg-white ${variantTab === "whatsapp" ? "block" : "hidden"}`}
                              data-placeholder="Start writing..."
                              suppressContentEditableWarning={true}
                            />

                            {/* Word Counter */}
                            <div className="absolute bottom-3 right-4 px-2 py-0.5 rounded bg-zinc-100 text-[10px] font-bold text-zinc-450 shadow-3xs select-none">
                              {(() => {
                                const activeVal =
                                  variantTab === "default" ? vDefaultDetailed :
                                    variantTab === "agent" ? vAgentDetailed :
                                      variantTab === "chatbot" ? vChatbotDetailed :
                                        vWhatsappDetailed;
                                const textClean = activeVal.replace(/<[^>]*>/g, " ").trim();
                                const wordCount = textClean ? textClean.split(/\s+/).length : 0;
                                return `${wordCount} words`;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {variantTab === "agent" && (
                        <div className="space-y-2 pt-4 border-t border-zinc-150 text-left">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Interactive Troubleshooting Flow JSON</label>
                            <button
                              type="button"
                              onClick={() => setVAgentFlow(JSON.stringify(SAMPLE_TROUBLESHOOTING_FLOW, null, 2))}
                              className="rounded border border-zinc-250 bg-white px-2 py-1 text-[9px] font-bold text-zinc-700 hover:text-zinc-955 shadow-2xs cursor-pointer"
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
                            <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 mt-2">
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
                      )}

                      {/* Picture Guide Direct Upload Card */}
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
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
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* WORKFLOWS REVIEW QUEUE */}
          {currentTab === "workflows" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">Article Workflows Queue</h3>
                    <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Review and approve articles moving through the editorial pipeline.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500"/>
                      IN REVIEW: {articles.filter(a => a.status === "InReview").length}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>
                      APPROVED: {articles.filter(a => a.status === "Approved").length}
                    </span>
                  </div>
                </div>

                {articles.filter(a => a.status === "InReview" || a.status === "Approved").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                      <span className="text-2xl">✅</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-400">All clear!</p>
                    <p className="text-xs text-zinc-350 font-medium mt-1">No articles are waiting for review or approval.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 uppercase text-[10px] font-bold">
                          <th className="px-5 py-3.5">Article Title</th>
                          <th className="px-5 py-3.5">Category</th>
                          <th className="px-5 py-3.5">Author</th>
                          <th className="px-5 py-3.5">Stage</th>
                          <th className="px-5 py-3.5">Next Stage</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {articles
                          .filter(a => a.status === "InReview" || a.status === "Approved")
                          .map(art => {
                            const isOwnArticle = art.author_id === currentUserId;
                            const nextStatus = art.status === "InReview" ? "Approved" : "Published";
                            const nextLabel = art.status === "InReview" ? "Approve" : "Publish";
                            return (
                              <tr key={art.id} className="hover:bg-zinc-50/60 transition-colors">
                                <td className="px-5 py-4">
                                  <div className="font-bold text-zinc-900 leading-tight">{art.title}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">/{art.slug}</div>
                                </td>
                                <td className="px-5 py-4 text-zinc-500 font-medium">{art.category?.name || "—"}</td>
                                <td className="px-5 py-4">
                                  <div className="text-zinc-700 font-semibold">{art.author?.name || "Unknown"}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono">{art.author?.email}</div>
                                </td>
                                <td className="px-5 py-4">
                                  {art.status === "InReview" ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500"/>
                                      In Review
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>
                                      Approved
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4">
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600">
                                    ➔ {nextStatus}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                                  <Link
                                    href={`/articles/${art.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 shadow-2xs"
                                  >
                                    View
                                  </Link>
                                  {isOwnArticle ? (
                                    <span className="inline-flex items-center gap-1 rounded border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-500 cursor-not-allowed" title="Separation of duties: You are the author and cannot approve your own article">
                                      ⛔ Cannot Approve
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleDirectStatusTransition(art.id, nextStatus)}
                                      className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 text-[10px] font-bold text-green-700 shadow-2xs transition-colors"
                                    >
                                      ✓ {nextLabel}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusTransition(art.id, "Draft")}
                                    className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 text-[10px] font-bold text-red-600 shadow-2xs transition-colors"
                                  >
                                    ✕ Reject
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Workflow Pipeline Legend */}
              <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-4">Editorial Pipeline</h4>
                <div className="flex items-center gap-0">
                  {[
                    { label: "Draft", color: "bg-zinc-200 text-zinc-600", active: false },
                    { label: "In Review", color: "bg-blue-100 text-blue-700", active: true },
                    { label: "Approved", color: "bg-amber-100 text-amber-700", active: true },
                    { label: "Published", color: "bg-green-100 text-green-700", active: false },
                    { label: "Archived", color: "bg-red-100 text-red-600", active: false },
                  ].map((stage, i, arr) => (
                    <div key={stage.label} className="flex items-center">
                      <div className={`rounded-full px-3 py-1.5 text-[10px] font-bold border ${
                        stage.active ? "border-current ring-2 ring-offset-1 ring-current/20" : "border-transparent"
                      } ${stage.color}`}>
                        {stage.active && <span className="mr-1">👁</span>}{stage.label}
                      </div>
                      {i < arr.length - 1 && (
                        <span className="mx-2 text-zinc-300 font-bold text-sm">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 font-medium mt-3">Highlighted stages are currently visible in this Workflows queue. Approving an article automatically advances it to the next stage.</p>
              </div>
            </div>
          )}

          {/* KNOWLEDGE GAPS QUEUE VIEW */}
          {currentTab === "gaps" && (
            <div className="space-y-6">
              {/* Status & Date range selectors */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
                <div className="flex flex-wrap gap-2">
                  {["ALL", "NEW", "IN_PROGRESS", "RESOLVED", "DISMISSED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setGapStatusFilter(st)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${gapStatusFilter === st
                          ? "bg-zinc-950 text-white border-zinc-950"
                          : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-650">
                  <span>From:</span>
                  <input
                    type="date"
                    value={gapStartDate}
                    onChange={(e) => setGapStartDate(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-800 focus:outline-hidden bg-white"
                  />
                  <span>To:</span>
                  <input
                    type="date"
                    value={gapEndDate}
                    onChange={(e) => setGapEndDate(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-800 focus:outline-hidden bg-white"
                  />
                  {(gapStartDate || gapEndDate) && (
                    <button
                      onClick={() => {
                        setGapStartDate("");
                        setGapEndDate("");
                      }}
                      className="text-red-500 hover:underline ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
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
                      {gaps.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-400 font-semibold">
                            No knowledge gaps found in this queue.
                          </td>
                        </tr>
                      ) : (
                        gaps.map((g) => (
                          <tr key={g.id} className="hover:bg-zinc-50/50">
                            <td className="p-4 font-bold text-zinc-955 italic">"{g.query_text}"</td>
                            <td className="p-4 font-mono font-bold text-zinc-600">{g.occurrences}x</td>
                            <td className="p-4">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${g.status === "RESOLVED"
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
                                <>
                                  <button
                                    onClick={() => handleClaimGap(g.id)}
                                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-650 shadow-2xs"
                                  >
                                    Claim Gap
                                  </button>
                                  <button
                                    onClick={() => handleCreateArticleFromGap(g)}
                                    className="rounded bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                                  >
                                    Create Article
                                  </button>
                                </>
                              )}
                              {g.status === "IN_PROGRESS" && (
                                <>
                                  <button
                                    onClick={() => setResolvingGap(g)}
                                    className="rounded bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                                  >
                                    Resolve Gap
                                  </button>
                                  <button
                                    onClick={() => handleCreateArticleFromGap(g)}
                                    className="rounded bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs"
                                  >
                                    Create Article
                                  </button>
                                </>
                              )}
                              {g.status === "RESOLVED" && (
                                <div className="flex items-center justify-end gap-2 text-xs">
                                  <span className="text-[10px] text-zinc-400 font-medium truncate max-w-40">
                                    Resolved ➔ {g.resolving_article?.title || "Linked Article"}
                                  </span>
                                  <button
                                    onClick={() => handleUnresolveGap(g.id)}
                                    className="rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 shadow-2xs transition-colors"
                                  >
                                    Rollback
                                  </button>
                                </div>
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

          {/* AUDIT LOGS VIEW */}
          {currentTab === "audit" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                <div className="border-b border-zinc-200 bg-zinc-50/50 p-4 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">System Audit Logs</h3>
                  <button
                    type="button"
                    onClick={fetchAuditLogs}
                    className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-650"
                  >
                    Refresh Logs
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Actor</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Target Type</th>
                        <th className="p-4">Target Label</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-zinc-400 font-semibold">
                            No audit logs recorded.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-50/50">
                            <td className="p-4 text-zinc-500 font-mono">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="p-4 font-bold text-zinc-900">
                              {log.actor?.name || "System"}{" "}
                              <span className="text-[10px] text-zinc-400 font-normal">({log.actor?.email})</span>
                            </td>
                            <td className="p-4 font-bold text-zinc-800 uppercase tracking-wider text-[10px]">{log.action}</td>
                            <td className="p-4 text-zinc-500 font-medium">{log.target_type}</td>
                            <td className="p-4 text-zinc-955 font-semibold">{log.target_label}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {currentTab === "analytics" && (
            <div className="space-y-6">
              {loadingAnalytics && !analyticsData ? (
                <div className="text-center py-12 text-zinc-450 font-semibold animate-pulse">Loading analytics data...</div>
              ) : !analyticsData ? (
                <div className="text-center py-12 text-zinc-400 italic">No analytics data available.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Total KB Views</span>
                      <span className="text-3xl font-extrabold text-zinc-950 mt-1 block">
                        {analyticsData.topArticles.reduce((acc: number, curr: any) => acc + curr.views, 0)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Total Macro Clicks</span>
                      <span className="text-3xl font-extrabold text-zinc-950 mt-1 block">
                        {analyticsData.topArticles.reduce((acc: number, curr: any) => acc + curr.clicks, 0)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Active Article Count</span>
                      <span className="text-3xl font-extrabold text-zinc-950 mt-1 block">{articles.length}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                    <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">7-Day Access Trends</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                            <th className="p-4">Date</th>
                            <th className="p-4">Article Views</th>
                            <th className="p-4">Macro Clicks</th>
                            <th className="p-4">Total Interactions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150">
                          {analyticsData.dailyTrend.map((t: any) => (
                            <tr key={t.date} className="hover:bg-zinc-50/50">
                              <td className="p-4 font-mono font-bold text-zinc-650">{t.date}</td>
                              <td className="p-4 font-semibold text-zinc-800">{t.views} views</td>
                              <td className="p-4 font-semibold text-zinc-800">{t.clicks} clicks</td>
                              <td className="p-4 font-bold text-zinc-950">{t.views + t.clicks} interactions</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                      <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Top Performing Articles</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                              <th className="p-4">Article Title</th>
                              <th className="p-4">Views</th>
                              <th className="p-4">Clicks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150">
                            {analyticsData.topArticles.map((a: any) => (
                              <tr key={a.id} className="hover:bg-zinc-50/50">
                                <td className="p-4 font-bold text-zinc-950 truncate max-w-xs">{a.label}</td>
                                <td className="p-4 font-semibold text-zinc-600">{a.views}</td>
                                <td className="p-4 font-semibold text-zinc-600">{a.clicks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                      <div className="border-b border-zinc-200 bg-zinc-50/50 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-455">Agent Usage Ranking</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-zinc-800 text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-bold">
                              <th className="p-4">Agent Name</th>
                              <th className="p-4">Views</th>
                              <th className="p-4">Clicks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150">
                            {analyticsData.topAgents.map((ag: any) => (
                              <tr key={ag.id} className="hover:bg-zinc-50/50">
                                <td className="p-4 font-bold text-zinc-950 truncate">
                                  {ag.name}{" "}
                                  <span className="text-[10px] text-zinc-400 font-normal">({ag.email})</span>
                                </td>
                                <td className="p-4 font-semibold text-zinc-600">{ag.views}</td>
                                <td className="p-4 font-semibold text-zinc-600">{ag.clicks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* RESOLUTION MODAL OVERLAY FOR GAPS */}
          {resolvingGap && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-955">Resolve Knowledge Gap</h3>
                  <p className="text-xs text-zinc-500 font-semibold mt-1">
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
                      className="rounded border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-650"
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

          {/* REJECTION FEEDBACK INPUT MODAL OVERLAY */}
          {rejectionModalArticleId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4 text-left">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                    Rejection Feedback
                  </h4>
                  <p className="text-[10px] text-zinc-450 font-medium mt-1">
                    Please provide a rejection reason/feedback. The author will see this feedback in order to revise and resubmit.
                  </p>
                </div>
                <div className="space-y-2">
                  <textarea
                    required
                    rows={4}
                    value={rejectionModalComment}
                    onChange={(e) => setRejectionModalComment(e.target.value)}
                    placeholder="e.g. Please clarify step 3, update the screenshots, check spelling..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-850 focus:outline-hidden"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-zinc-150">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectionModalArticleId(null);
                      setRejectionModalComment("");
                    }}
                    className="rounded border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-650"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!rejectionModalComment.trim()) {
                        alert("Please enter a rejection comment.");
                        return;
                      }
                      handleDirectStatusTransition(rejectionModalArticleId, "Draft", rejectionModalComment);
                    }}
                    className="rounded bg-red-650 hover:bg-red-750 px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    Submit Rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
