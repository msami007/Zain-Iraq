"use client";

import { useState } from "react";

type FeedbackFormProps = {
  articleId: string;
};

export default function ArticleFeedbackForm({ articleId }: FeedbackFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRating = async (isHelpful: boolean) => {
    setRating(isHelpful);
    if (isHelpful) {
      // For "Yes", submit immediately
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch("/api/v1/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            article_id: articleId,
            helpful: true,
          }),
        });
        if (!res.ok) {
          throw new Error("Failed to submit feedback");
        }
        setSubmitted(true);
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          article_id: articleId,
          helpful: false,
          comment: comment,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-xs">
        <h4 className="text-sm font-bold text-zinc-900">Thank you for your feedback!</h4>
        <p className="mt-1 text-xs text-zinc-500 font-medium">Your input helps us improve support content.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      {rating === null ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-zinc-950">Was this article helpful?</h4>
            <p className="text-xs text-zinc-500 font-medium">Let us know what you think.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRating(true)}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all shadow-xs min-w-[70px]"
            >
              Yes
            </button>
            <button
              onClick={() => handleRating(false)}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all shadow-xs min-w-[70px]"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCommentSubmit} className="space-y-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-950">How can we improve this article?</h4>
            <p className="text-xs text-zinc-500 font-medium">Please provide more details about what was missing or incorrect.</p>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            rows={3}
            placeholder="Tell us more (e.g. step was outdated, missing link, etc.)"
            className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:outline-hidden transition-all shadow-xs resize-none"
          />
          {error && <p className="text-xs font-semibold text-red-650">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setRating(null)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-850"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-zinc-950 hover:bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
