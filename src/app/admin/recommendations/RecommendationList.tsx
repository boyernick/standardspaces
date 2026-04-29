"use client";

import { useState, useMemo } from "react";
import { Sparkles, Search } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

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

type StatusFilter = "all" | "pending" | "scraped";

const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

export default function RecommendationList({
  recommendations: initial,
}: {
  recommendations: Recommendation[];
}) {
  const [recommendations, setRecommendations] = useState(initial);
  const [filter, setFilter] = useState<StatusFilter>("scraped");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recommendations.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      const haystack = [r.name, r.url, r.category, r.neighborhood, r.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recommendations, filter, query]);

  const counts = {
    all: recommendations.length,
    pending: recommendations.filter((r) => r.status === "pending").length,
    scraped: recommendations.filter((r) => r.status === "scraped").length,
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
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "scraped", processed_at: new Date().toISOString() }
              : r
          )
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
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recommendations..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 placeholder:text-black/40 dark:placeholder:text-white/40 transition-colors"
          style={fontCalibre}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6" style={fontCalibre}>
        {(["scraped", "pending", "all"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                : "border-black/15 dark:border-white/15 text-black/60 dark:text-white/60 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No recommendations"
          body={
            filter === "all"
              ? "Submitted recommendations will show up here."
              : `Nothing in the “${filter}” bucket right now.`
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const thumb = rec.scraped_images?.[0];
            const isBusy = busy === rec.id;
            return (
              <div
                key={rec.id}
                className="border border-black/10 dark:border-white/10 rounded-2xl p-4 flex flex-wrap sm:flex-nowrap items-center gap-4"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={rec.name ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-600 text-xs">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-black dark:text-white" style={fontCalibre}>
                    {rec.name || "Untitled"}
                  </p>
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white break-all transition-colors"
                    style={fontCalibre}
                  >
                    {rec.url}
                  </a>
                  {rec.notes && (
                    <p className="text-xs text-black/50 dark:text-white/50 mt-1 italic line-clamp-1" style={fontCalibre}>
                      &ldquo;{rec.notes}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex items-stretch gap-2 w-full sm:w-auto sm:shrink-0">
                  {(rec.status === "scraped" || rec.status === "published") && (
                    <ButtonLink
                      href={`/admin/review/${rec.id}`}
                      variant="primary"
                      size="sm"
                      className="flex-1 py-2.5 text-sm sm:flex-none sm:py-1.5 sm:text-xs"
                    >
                      {rec.status === "published" ? "View" : "Review"}
                    </ButtonLink>
                  )}
                  {rec.status !== "processing" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRescrape(rec.id, rec.url)}
                      disabled={isBusy}
                      className="flex-1 py-2.5 text-sm sm:flex-none sm:py-1.5 sm:text-xs"
                    >
                      {isBusy ? "…" : "Re-scrape"}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(rec.id)}
                    disabled={isBusy}
                    className="flex-1 py-2.5 text-sm sm:flex-none sm:py-1.5 sm:text-xs"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
