"use client";

import { useEffect } from "react";

export default function ArticleViewTracker({
  articleId,
  articleTitle,
  tenantId,
}: {
  articleId: string;
  articleTitle: string;
  tenantId: string;
}) {
  useEffect(() => {
    // Fire once on mount — records the view in the audit log for analytics
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
