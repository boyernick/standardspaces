"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, CATEGORY_ORDER, TOP_VIBES, Category, Spot } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { Search, MapPin, X } from "lucide-react";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-neutral-900 dark:text-white font-semibold">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch spots once on first open
  useEffect(() => {
    if (!open || spots.length > 0) return;
    let cancelled = false;
    createClient()
      .from("spots")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSpots(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          category: r.category as Category[],
          subcategory: r.subcategory as string[] | undefined,
          vibes: r.vibes as string[] | undefined,
          neighborhood: r.neighborhood as string,
          city: r.city as string,
          description: r.description as string,
          address: r.address as string,
          images: r.images as string[],
          lng: r.lng as number,
          lat: r.lat as number,
          priceRange: r.price_range as string | undefined,
        } as Spot)));
      });
    return () => { cancelled = true; };
  }, [open, spots.length]);

  const neighborhoods = useMemo(() => [...new Set(spots.map((s) => s.neighborhood))].sort(), [spots]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.category.some((c) => CATEGORY_LABELS[c].toLowerCase().includes(q)) ||
        (s.vibes && s.vibes.some((v) => v.toLowerCase().includes(q)))
    );
  }, [query, spots]);

  const matchingNeighborhoods = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return neighborhoods.filter((n) => n.toLowerCase().includes(q));
  }, [query, neighborhoods]);

  const matchingCategories = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CATEGORY_ORDER.filter((c) =>
      CATEGORY_LABELS[c].toLowerCase().includes(q)
    );
  }, [query]);

  const flatItems = useMemo(() => {
    const all: Array<{ type: string; value: string }> = [];
    for (const n of matchingNeighborhoods) all.push({ type: "neighborhood", value: n });
    for (const c of matchingCategories) all.push({ type: "category", value: c });
    for (const s of results) all.push({ type: "spot", value: s.id });
    return all;
  }, [matchingNeighborhoods, matchingCategories, results]);

  const hasQuery = query.trim().length > 0;
  const hasResults = flatItems.length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [flatItems]);

  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) selectItem(item);
    }
  }

  function selectItem(item: { type: string; value: string }) {
    if (item.type === "spot") {
      const spot = spots.find((s) => s.id === item.value);
      if (spot) {
        setOpen(false);
        router.push(`/${citySlugFromName(spot.city)}/${spot.id}`);
      }
    } else {
      setQuery(item.type === "category" ? CATEGORY_LABELS[item.value as Category] : item.value);
      inputRef.current?.focus();
    }
  }

  function handleQuickFilter(value: string) {
    setQuery(value);
    inputRef.current?.focus();
  }

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] md:pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: "fadeIn 0.15s ease-out" }} />

      <div
        className="relative w-full max-w-lg mx-4 md:mx-0 bg-surface rounded-2xl shadow-2xl dark:shadow-neutral-900/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "command-in 0.2s cubic-bezier(0.25,0.1,0.25,1)" }}
      >
        {/* Search input — large and prominent */}
        <div className="relative px-5 pt-5 pb-4">
          <Search size={20} strokeWidth={2} className="absolute left-8 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search spaces..."
            className="w-full pl-10 pr-10 py-3 text-base bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-500 border-b border-neutral-100 dark:border-neutral-800"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <X size={12} strokeWidth={2} className="text-neutral-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto scrollbar-hide">
          {!hasQuery ? (
            <div className="px-5 pb-5 space-y-4">
              {/* Vibes — single scrollable row */}
              <div>
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-2">
                  Vibes
                </p>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
                  {TOP_VIBES.map((vibe) => (
                    <button
                      key={vibe}
                      onClick={() => handleQuickFilter(vibe)}
                      className="px-3 py-1.5 text-xs rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending — with thumbnails */}
              {spots.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-2">
                    Trending
                  </p>
                  <div className="space-y-1 -mx-2">
                    {spots.slice(0, 5).map((spot) => (
                      <button
                        key={spot.id}
                        onClick={() => {
                          setOpen(false);
                          router.push(`/${citySlugFromName(spot.city)}/${spot.id}`);
                        }}
                        className="w-full text-left px-2 py-2 rounded-xl flex items-center gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                      >
                        {spot.images?.[0] && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={spot.images[0]} alt="" className="w-full h-full object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{spot.name}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !hasResults ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Try a name, neighborhood, or vibe
              </p>
            </div>
          ) : (
            <div className="pb-2" style={{ animation: "fadeIn 0.15s ease-out" }}>
              {/* Neighborhood matches */}
              {matchingNeighborhoods.length > 0 && (
                <div>
                  <div className="px-5 pt-1 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Neighborhoods</p>
                  </div>
                  {matchingNeighborhoods.map((n) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const count = spots.filter((s) => s.neighborhood === n).length;
                    return (
                      <button
                        key={n}
                        data-selected={isSelected}
                        onClick={() => handleQuickFilter(n)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        <MapPin size={16} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium"><Highlight text={n} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">{count} spaces</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Category matches */}
              {matchingCategories.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Categories</p>
                  </div>
                  {matchingCategories.map((c) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const count = spots.filter((s) => s.category.includes(c)).length;
                    return (
                      <button
                        key={c}
                        data-selected={isSelected}
                        onClick={() => handleQuickFilter(CATEGORY_LABELS[c])}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        <Search size={14} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium"><Highlight text={CATEGORY_LABELS[c]} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">{count} spaces</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Spot results — with thumbnails */}
              {results.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Spaces</p>
                  </div>
                  {results.map((spot) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={spot.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "spot", value: spot.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        {spot.images?.[0] && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={spot.images[0]} alt="" className="w-full h-full object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate"><Highlight text={spot.name} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                            <Highlight text={spot.neighborhood} query={query} /> · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes command-in {
          from { opacity: 0; transform: scale(0.96) translateY(-12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
