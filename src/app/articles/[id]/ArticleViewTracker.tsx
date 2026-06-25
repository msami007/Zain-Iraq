"use client";

import { useEffect } from "react";

export default function ArticleViewTracker({
  articleId,
  articleTitle,
  tenantId,
  userRole,
}: {
  articleId: string;
  articleTitle: string;
  tenantId: string;
  userRole?: string;
}) {
  useEffect(() => {
    // Skip tracking for Admin/SuperAdmin to avoid inflating public view metrics
    if (userRole === "Admin" || userRole === "SuperAdmin") return;
    fetch("/api/v1/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({
        article_id: articleId,
        action: "View Article",
        label: articleTitle,
      }),
    }).catch(() => {});
  }, [articleId]);

  return null;
}
