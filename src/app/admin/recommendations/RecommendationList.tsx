"use client";

import { useState } from "react";
import Link from "next/link";

type Recommendation = {
  id: string;
  name: string | null;
  url: string;
  status: string;
  category: string | null;
  neighborhood: string | null;
  notes: string | null;
  additional_urls: string[] | null;
  scraped_images: string[] | null;
  created_at: string;
  processed_at: string | null;
};

type StatusFilter = "all" | "pending" | "processing" | "scraped" | "published";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  scraped: "bg-purple-100 text-purple-800",
  published: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

export default function RecommendationList({
  recommendations: initial,
}: {
  recommendations: Recommendation[];
}) {
  const [recommendations, setRecommendations] = useState(initial);
  const [filter, setFilter] = useState<StatusFilter>("scraped");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered =
    filter === "all" ? recommendations : recommendations.filter((r) => r.status === filter);

  const counts = {
    all: recommendations.length,
    pending: recommendations.filter((r) => r.status === "pending").length,
    processing: recommendations.filter((r) => r.status === "processing").length,
    scraped: recommendations.filter((r) => r.status === "scraped").length,
    published: recommendations.filter((r) => r.status === "published").length,
  };

  async function handleRescrape(id: string, url: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: id, url }),
      });
      if (res.ok) {
        setRecommendations((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "processing" } : r))
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recommendation? This cannot be undone.")) return;
    setBusy(id);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: id }),
      });
      if (res.ok) {
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" style={fontCalibre}>
        {(["scraped", "pending", "processing", "published", "all"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-black text-white border-black"
                : "border-black/15 text-black/60 hover:border-black/30"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/40" style={fontCalibre}>
          No recommendations.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const thumb = rec.scraped_images?.[0];
            const photoCount = rec.scraped_images?.length ?? 0;
            return (
              <div
                key={rec.id}
                className="border border-black/10 rounded-lg p-4 bg-white flex items-start gap-4"
              >
                <div
                  className="w-14 h-14 rounded-md shrink-0 bg-neutral-100 bg-cover bg-center"
                  style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={fontCalibre}>
                        {rec.name || "Untitled"}
                      </p>
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-black/50 hover:text-brand-500 break-all"
                        style={fontCalibre}
                      >
                        {rec.url}
                      </a>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[rec.status] ?? "bg-neutral-100 text-neutral-700"
                      }`}
                      style={fontCalibre}
                    >
                      {rec.status}
                    </span>
                  </div>

                  {(rec.category || rec.neighborhood) && (
                    <p className="text-xs text-black/40 mt-1" style={fontCalibre}>
                      {[rec.category, rec.neighborhood].filter(Boolean).join(" · ")}
                    </p>
                  )}

                  {rec.notes && (
                    <p className="text-xs text-black/50 mt-1 italic line-clamp-2" style={fontCalibre}>
                      &ldquo;{rec.notes}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-black/30" style={fontCalibre}>
                    <span>
                      {new Date(rec.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span>·</span>
                    <span>
                      {photoCount} photo{photoCount !== 1 ? "s" : ""}
                    </span>
                    {rec.additional_urls && rec.additional_urls.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {rec.additional_urls.length} extra link
                          {rec.additional_urls.length !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {(rec.status === "scraped" || rec.status === "published") && (
                      <Link
                        href={`/admin/review/${rec.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors"
                        style={fontCalibre}
                      >
                        {rec.status === "published" ? "View" : "Review & publish"}
                      </Link>
                    )}
                    {rec.status !== "processing" && (
                      <button
                        onClick={() => handleRescrape(rec.id, rec.url)}
                        disabled={busy === rec.id}
                        className="px-3 py-1.5 text-xs font-medium text-black/60 border border-black/15 rounded-full hover:border-black/30 transition-colors disabled:opacity-50"
                        style={fontCalibre}
                      >
                        {busy === rec.id ? "..." : "Re-scrape"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(rec.id)}
                      disabled={busy === rec.id}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-full hover:border-red-300 transition-colors disabled:opacity-50"
                      style={fontCalibre}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
