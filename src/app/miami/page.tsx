"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { getSpotsByCity } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ORDER, Category, Spot } from "@/lib/types";
import Map from "@/components/Map";
import ImageCarousel from "@/components/ImageCarousel";
import { ChevronDown, Search, ChevronLeft, ChevronRight, Map as MapIcon, List } from "lucide-react";

const allSpots = getSpotsByCity("Miami");
const activeCategories = new Set(allSpots.map((s) => s.category));
const categories = CATEGORY_ORDER.filter((c) => activeCategories.has(c));
const neighborhoods = [...new Set(allSpots.map((s) => s.neighborhood))].sort();

export default function MiamiPage() {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const neighborhoodRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!neighborhoodOpen) return;
    function handleClick(e: MouseEvent) {
      if (neighborhoodRef.current && !neighborhoodRef.current.contains(e.target as Node)) {
        setNeighborhoodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [neighborhoodOpen]);
  const [page, setPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const filtered = useMemo(() => {
    let result = allSpots;

    if (activeCategory) {
      result = result.filter((s) => s.category === activeCategory);
    }
    if (activeNeighborhood) {
      result = result.filter((s) => s.neighborhood === activeNeighborhood);
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, activeNeighborhood]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSpotSelect = useCallback((spot: Spot | null) => {
    setActiveSpot(spot);
  }, []);

  const clearAll = () => {
    setActiveCategory(null);
    setActiveNeighborhood(null);
    setActiveSpot(null);
    setPage(1);
  };

  const hasFilters = activeCategory || activeNeighborhood;

  return (
    <div className="h-[calc(100dvh-49px)] flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 relative z-30 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 md:px-6 py-2.5 flex items-center gap-3 overflow-visible">
        {/* 1. Neighborhood — "Where am I going?" */}
        <div ref={neighborhoodRef} className="relative shrink-0">
          <button
            onClick={() => setNeighborhoodOpen(!neighborhoodOpen)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
              activeNeighborhood
                ? "bg-brand-900 text-white border-brand-900"
                : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
            }`}
          >
            {activeNeighborhood ?? "Neighborhood"}
            <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${neighborhoodOpen ? "rotate-180" : ""}`} />
          </button>
          {neighborhoodOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg dark:shadow-neutral-900/50 py-1 z-50 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setActiveNeighborhood(null); setNeighborhoodOpen(false); setPage(1); }}
                className={`block w-full text-left px-4 py-2.5 text-xs transition-colors ${
                  !activeNeighborhood ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                All neighborhoods
              </button>
              {neighborhoods.map((n) => {
                const count = allSpots.filter((s) => s.neighborhood === n).length;
                return (
                  <button
                    key={n}
                    onClick={() => { setActiveNeighborhood(activeNeighborhood === n ? null : n); setNeighborhoodOpen(false); setPage(1); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors ${
                      activeNeighborhood === n ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {n}
                    <span className="text-neutral-300 dark:text-neutral-600">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 shrink-0" />

        {/* 2. Category Pills — "What am I looking for?" */}
        <div className="flex gap-1.5 shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(activeCategory === cat ? null : cat);
                setActiveSpot(null);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-brand-900 text-white border-brand-900"
                  : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* 3. Search — opens command menu */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden md:flex items-center justify-between w-[168px] pl-3 pr-2.5 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded-full bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <Search size={13} strokeWidth={2} />
            Search
          </span>
          <kbd className="text-[10px] text-neutral-300 dark:text-neutral-600 border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        {/* Mobile search icon */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="md:hidden flex items-center justify-center w-8 h-8 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors shrink-0"
          aria-label="Search"
        >
          <Search size={16} strokeWidth={2} />
        </button>

        {/* Clear button */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content: Panel + Map */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Panel */}
        <div
          ref={panelRef}
          className={`w-full md:w-1/2 md:min-w-0 md:block overflow-y-auto border-r border-neutral-200 dark:border-neutral-800 ${
            mobileView === "list" ? "flex-1" : "hidden"
          }`}
        >
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No spaces found</p>
              <button
                onClick={clearAll}
                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mt-2 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
                {paginated.map((spot) => (
                  <div
                    key={spot.id}
                    className="cursor-pointer rounded-xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 p-3 -m-3 transition-colors"
                    onMouseEnter={() => setActiveSpot(spot)}
                    onMouseLeave={() => setActiveSpot(null)}
                  >
                    <Link href={`/miami/${spot.id}`}>
                      <ImageCarousel
                        images={spot.images}
                        alt={spot.name}
                      />
                    </Link>

                    <div className="mt-3">
                      <h3 className="font-medium text-base leading-tight">{spot.name}</h3>
                      <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {CATEGORY_LABELS[spot.category]} · {spot.neighborhood}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">
                        {spot.description.split(". ")[0]}.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6 pb-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    <ChevronLeft size={12} strokeWidth={1.5} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-brand-900 text-white"
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    <ChevronRight size={12} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div
          className={`md:flex-1 md:block relative ${
            mobileView === "map" ? "flex-1" : "hidden"
          }`}
        >
          <Map
            spots={filtered}
            activeSpot={activeSpot}
            onSpotSelect={handleSpotSelect}
          />
        </div>
      </div>

      {/* Floating Map/List toggle button (mobile only) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
          className="flex items-center gap-2 px-5 py-3 bg-brand-900 text-white text-sm font-medium rounded-full shadow-lg hover:bg-brand-800 transition-colors"
        >
          {mobileView === "list" ? (
            <>
              <MapIcon size={16} strokeWidth={2} />
              Map
            </>
          ) : (
            <>
              <List size={16} strokeWidth={2} />
              List
            </>
          )}
        </button>
      </div>
    </div>
  );
}
