"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_ORDER, Category, Spot } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import ImageCarousel from "@/components/ImageCarousel";
import { NewBadge } from "@/lib/new-badge";
import { CircleCheck, Search, X, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";

const PER_PAGE_SM = 8;
const PER_PAGE_LG = 9;

export default function CheckinsClient({ spots, citySlug, ratings = {} }: { spots: Spot[]; citySlug: string; ratings?: Record<string, number> }) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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

  const perPage = typeof window !== "undefined" && window.innerWidth >= 1024 ? PER_PAGE_LG : PER_PAGE_SM;
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-10 pt-4 pb-8">
          <div className="text-center mb-4">
            <h1 className="mb-1">Check-ins</h1>
          </div>

          {spots.length > 0 && categories.length > 1 && (
            <div className="flex justify-center gap-1.5 overflow-x-auto scrollbar-hide mb-5">
              <button
                onClick={() => { setActiveCategory(null); setPage(1); }}
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
                  onClick={() => { setActiveCategory(activeCategory === cat ? null : cat); setPage(1); }}
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

          {filtered.length === 0 && spots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                <CircleCheck size={20} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-medium">No check-ins yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                Check in when you visit a space to track where you&apos;ve been.
              </p>
              <Link href={`/${citySlug}`} className="inline-block mt-4 text-sm font-medium text-neutral-900 dark:text-white hover:underline">
                Browse spaces
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-24 text-center">
              <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-ink-100">
                <SlidersHorizontal size={22} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
              </div>
              <h3 className="text-base font-medium">No spaces match</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                Nothing in your check-ins fits this combination.
              </p>
              <div className="mt-6">
                <Button onClick={() => { setActiveCategory(null); setQuery(""); setPage(1); }}>Clear all filters</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
                {paginated.map((spot) => (
                  <div key={spot.id}>
                    <Link href={`/${citySlugFromName(spot.city)}/${spot.id}`} className="block relative">
                      <NewBadge spot={spot} overlay />
                      <ImageCarousel images={spot.images} alt={spot.name} />
                    </Link>
                    <div className="mt-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium text-base leading-tight">{spot.name}</h3>
                        {ratings[spot.id] !== undefined && (
                          <span className="ml-auto text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-200 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                            {ratings[spot.id].toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                  >
                    <ChevronLeft size={14} strokeWidth={2} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                  >
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {spots.length > 0 && (
        <div className="shrink-0 md:hidden bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto relative">
            <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search check-ins"
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
