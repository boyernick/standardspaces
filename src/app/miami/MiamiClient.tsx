"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, Category, Spot } from "@/lib/types";
import Map from "@/components/Map";
import ImageCarousel from "@/components/ImageCarousel";
import Navbar from "@/components/Navbar";
import { ChevronDown, ChevronLeft, ChevronRight, Map as MapIcon, List, X, MapPin } from "lucide-react";

interface MiamiClientProps {
  spots: Spot[];
}

export default function MiamiClient({ spots: allSpots }: MiamiClientProps) {
  const activeCategories = useMemo(() => new Set(allSpots.map((s) => s.category)), [allSpots]);
  const categories = useMemo(() => CATEGORY_ORDER.filter((c) => activeCategories.has(c)), [activeCategories]);
  const neighborhoods = useMemo(() => [...new Set(allSpots.map((s) => s.neighborhood))].sort(), [allSpots]);

  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeSubcategories, setActiveSubcategories] = useState<Set<string>>(new Set());
  const [categoryDropdown, setCategoryDropdown] = useState<Category | null>(null);
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [page, setPage] = useState(1);
  const perPage = 6;

  const neighborhoodRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!neighborhoodOpen) return;
    function handleClick(e: MouseEvent) {
      if (neighborhoodRef.current && !neighborhoodRef.current.contains(e.target as Node)) setNeighborhoodOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [neighborhoodOpen]);

  useEffect(() => {
    if (!categoryDropdown) return;
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryDropdown(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [categoryDropdown]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const filtered = useMemo(() => {
    let result = allSpots;
    if (activeCategory) {
      result = result.filter((s) => s.category === activeCategory);
      if (activeSubcategories.size > 0) {
        result = result.filter((s) => s.subcategory?.some((sc) => activeSubcategories.has(sc)));
      }
    }
    if (activeNeighborhood) {
      result = result.filter((s) => s.neighborhood === activeNeighborhood);
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, activeSubcategories, activeNeighborhood, allSpots]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSpotSelect = useCallback((spot: Spot | null) => { setActiveSpot(spot); }, []);

  const clearAll = () => {
    setActiveCategory(null);
    setActiveSubcategories(new Set());
    setCategoryDropdown(null);
    setActiveNeighborhood(null);
    setActiveSpot(null);
    setPage(1);
  };

  const hasFilters = activeCategory || activeNeighborhood;

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Panel — left */}
        <div className={`w-full md:w-1/2 md:min-w-0 md:flex md:flex-col ${mobileView === "list" ? "flex flex-col flex-1" : "hidden md:flex"}`}>
          {/* Filters bar — outside scrollable area so dropdowns aren't clipped */}
          {allSpots.length > 0 && <div className="relative z-20 bg-white dark:bg-neutral-950 px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              {/* Neighborhood */}
              <div ref={neighborhoodRef} className="relative shrink-0">
                <button
                  onClick={() => setNeighborhoodOpen(!neighborhoodOpen)}
                  className={`flex items-center justify-between gap-1.5 w-[142px] px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                    activeNeighborhood
                      ? "bg-brand-900 text-white border-brand-900"
                      : "bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  {activeNeighborhood ?? "Neighborhoods"}
                  {activeNeighborhood ? (
                    <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveNeighborhood(null); setNeighborhoodOpen(false); setPage(1); }} />
                  ) : (
                    <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${neighborhoodOpen ? "rotate-180" : ""}`} />
                  )}
                </button>
                {neighborhoodOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-50 max-h-60 overflow-y-auto scrollbar-hide">
                    <button onClick={() => { setActiveNeighborhood(null); setNeighborhoodOpen(false); setPage(1); }} className={`block w-full text-left px-4 py-2.5 text-xs transition-colors ${!activeNeighborhood ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                      All neighborhoods
                    </button>
                    {neighborhoods.map((n) => {
                      const count = allSpots.filter((s) => s.neighborhood === n).length;
                      return (
                        <button key={n} onClick={() => { setActiveNeighborhood(activeNeighborhood === n ? null : n); setNeighborhoodOpen(false); setPage(1); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors ${activeNeighborhood === n ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                          {n}
                          <span className="text-neutral-300 dark:text-neutral-600">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 shrink-0" />

              {/* Category pills */}
              <div ref={categoryRef} className="flex gap-1.5 shrink-0">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  const subs = SUBCATEGORIES[cat];
                  const isDropdownOpen = categoryDropdown === cat;
                  const activeSubCount = isActive ? activeSubcategories.size : 0;
                  return (
                    <div key={cat} className="relative">
                      <button
                        onClick={() => {
                          if (isActive) { isDropdownOpen ? setCategoryDropdown(null) : setCategoryDropdown(cat); }
                          else { setActiveCategory(cat); setActiveSubcategories(new Set()); setCategoryDropdown(cat); setActiveSpot(null); setPage(1); }
                        }}
                        className={`flex items-center gap-1 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                          isActive ? "bg-brand-900 text-white border-brand-900" : "bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                        {activeSubCount > 0 && <span className="text-[10px] opacity-70">({activeSubCount})</span>}
                        {isActive ? (
                          <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); setPage(1); }} />
                        ) : (
                          <ChevronDown size={10} strokeWidth={1.5} />
                        )}
                      </button>
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-50">
                          <button onClick={() => { setActiveSubcategories(new Set()); setPage(1); }} className={`block w-full text-left px-4 py-2 text-xs transition-colors ${activeSubCount === 0 ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                            All {CATEGORY_LABELS[cat]}
                          </button>
                          {subs.map((sub) => {
                            const isSubActive = activeSubcategories.has(sub);
                            return (
                              <button key={sub} onClick={() => { setActiveSubcategories((prev) => { const next = new Set(prev); isSubActive ? next.delete(sub) : next.add(sub); return next; }); setPage(1); }} className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition-colors ${isSubActive ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSubActive ? "bg-brand-900 border-brand-900" : "border-neutral-300 dark:border-neutral-600"}`}>
                                  {isSubActive && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </span>
                                {sub}
                              </button>
                            );
                          })}
                          <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                            <button onClick={() => { setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); setPage(1); }} className="block w-full text-left px-4 py-2 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Clear filter</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasFilters && (
                <button onClick={clearAll} className="text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0 ml-1">
                  Clear
                </button>
              )}
            </div>
          </div>}

          {/* Scrollable content */}
          <div ref={panelRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          {/* Cards */}
          {allSpots.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <MapPin size={20} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-medium">No spaces yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                We're curating the best spots in Miami.<br />Know a place that belongs here?
              </p>
              <Link href="/recommend" className="inline-block mt-4 text-sm font-medium text-brand-900 hover:underline">
                Recommend a space
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No spaces match your filters</p>
              <button onClick={clearAll} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white mt-2 transition-colors">Clear filters</button>
            </div>
          ) : (
            <div className="p-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
                {paginated.map((spot) => (
                  <div key={spot.id} className="cursor-pointer" onMouseEnter={() => setActiveSpot(spot)} onMouseLeave={() => setActiveSpot(null)}>
                    <Link href={`/miami/${spot.id}`}>
                      <ImageCarousel images={spot.images} alt={spot.name} />
                    </Link>
                    <div className="mt-3">
                      <h3 className="font-medium text-base leading-tight">{spot.name}</h3>
                      <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">{CATEGORY_LABELS[spot.category]} · {spot.neighborhood}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6 pb-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default transition-colors">
                    <ChevronLeft size={12} strokeWidth={1.5} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${p === page ? "bg-brand-900 text-white" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{p}</button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default transition-colors">
                    <ChevronRight size={12} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Map — right */}
        <div className={`md:flex-1 md:block relative p-4 ${mobileView === "map" ? "flex-1" : "hidden"}`}>
          <div className="w-full h-full rounded-2xl overflow-hidden">
            <Map spots={filtered} activeSpot={activeSpot} onSpotSelect={handleSpotSelect} />
          </div>
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <button onClick={() => setMobileView(mobileView === "list" ? "map" : "list")} className="flex items-center gap-2 px-5 py-3 bg-brand-900 text-white text-sm font-medium rounded-full shadow-lg hover:bg-brand-800 transition-colors">
          {mobileView === "list" ? (<><MapIcon size={16} strokeWidth={2} />Map</>) : (<><List size={16} strokeWidth={2} />List</>)}
        </button>
      </div>
    </div>
  );
}
