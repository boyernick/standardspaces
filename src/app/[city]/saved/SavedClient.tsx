"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_ORDER, Category, Spot } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import ImageCarousel from "@/components/ImageCarousel";
import SaveButton from "@/components/SaveButton";
import { Heart, Search, X } from "lucide-react";

export default function SavedClient({ spots, citySlug }: { spots: Spot[]; citySlug: string }) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const active = new Set(spots.flatMap((s) => s.category));
    return CATEGORY_ORDER.filter((c) => active.has(c));
  }, [spots]);

  const filtered = useMemo(() => {
    let result = spots;
    if (activeCategory) {
      result = result.filter((s) => s.category.includes(activeCategory));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.category.some((c) => CATEGORY_LABELS[c].toLowerCase().includes(q))
      );
    }
    return result;
  }, [spots, activeCategory, query]);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 pb-8">
          <h1 className="text-xl font-semibold tracking-tight mb-4">Saved spaces</h1>

          {/* Filters */}
          {spots.length > 0 && categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-5">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-all duration-200 whitespace-nowrap shrink-0 ${
                  !activeCategory
                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                    : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`px-3.5 py-1.5 text-sm rounded-full border transition-all duration-200 whitespace-nowrap shrink-0 ${
                    activeCategory === cat
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                      : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <Heart size={20} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-medium">
                {spots.length === 0 ? "No saved spaces yet" : "No matches"}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                {spots.length === 0
                  ? "Tap the heart on any space to save it here for later."
                  : "Try a different filter or search term."}
              </p>
              {spots.length === 0 && (
                <Link href={`/${citySlug}`} className="inline-block mt-4 text-sm font-medium text-neutral-900 dark:text-white hover:underline">
                  Browse spaces
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
              {filtered.map((spot) => (
                <div key={spot.id}>
                  <Link href={`/${citySlugFromName(spot.city)}/${spot.id}`}>
                    <ImageCarousel images={spot.images} alt={spot.name} />
                  </Link>
                  <div className="mt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-base leading-tight">{spot.name}</h3>
                      <SaveButton spotId={spot.id} initialSaved={true} size="sm" />
                    </div>
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search bar — fixed bottom */}
      {spots.length > 0 && (
        <div className="shrink-0 md:hidden bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto relative">
            <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved spaces"
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-neutral-100 dark:bg-neutral-900 border-0 rounded-full text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
