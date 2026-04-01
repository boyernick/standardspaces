"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CATEGORY_LABELS, CATEGORY_ORDER, TOP_VIBES, Category, Spot } from "@/lib/types";
import { Search, MapPin } from "lucide-react";

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
    supabase
      .from("spots")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setSpots(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
            category: r.category as Category,
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
        }
      });
  }, [open, spots.length]);

  const neighborhoods = useMemo(() => [...new Set(spots.map((s) => s.neighborhood))].sort(), [spots]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(q) ||
        (s.vibes && s.vibes.some((v) => v.toLowerCase().includes(q)))
    );
  }, [query]);

  const matchingNeighborhoods = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return neighborhoods.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

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
        router.push(`/${spot.city.toLowerCase()}/${spot.id}`);
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] md:pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl mx-4 md:mx-0 bg-surface rounded-2xl shadow-2xl dark:shadow-neutral-900/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "command-in 0.15s ease-out" }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 border-b border-neutral-100 dark:border-neutral-800">
          <Search size={18} strokeWidth={2} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, neighborhood, or vibe..."
            className="flex-1 py-4 text-sm bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-500"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto scrollbar-hide">
          {!hasQuery ? (
            <div className="p-5 space-y-5">
              {/* Vibe grid */}
              <div>
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-2.5">
                  Vibe
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TOP_VIBES.map((vibe) => (
                    <button
                      key={vibe}
                      onClick={() => handleQuickFilter(vibe)}
                      className="px-3 py-2.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-center"
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending */}
              <div>
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                  Trending in Miami
                </p>
                <div className="space-y-0.5">
                  {spots.slice(0, 6).map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/${spot.city.toLowerCase()}/${spot.id}`);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{spot.name}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                          {CATEGORY_LABELS[spot.category]} · {spot.neighborhood}
                          {spot.priceRange && ` · ${spot.priceRange}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No spaces match &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
                Try a name, neighborhood, category, or vibe like &ldquo;date night&rdquo;
              </p>
            </div>
          ) : (
            <div className="py-2">
              {/* Neighborhood matches */}
              {matchingNeighborhoods.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Neighborhoods</p>
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
                        {isSelected && <span className="text-[10px] text-neutral-300 dark:text-neutral-600 shrink-0">↵ filter</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Category matches */}
              {matchingCategories.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Categories</p>
                  </div>
                  {matchingCategories.map((c) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const count = spots.filter((s) => s.category === c).length;
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
                        {isSelected && <span className="text-[10px] text-neutral-300 dark:text-neutral-600 shrink-0">↵ filter</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Spot results */}
              {results.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Spaces</p>
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
                        className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate"><Highlight text={spot.name} query={query} /></p>
                            {spot.priceRange && (
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{spot.priceRange}</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {CATEGORY_LABELS[spot.category]} · <Highlight text={spot.neighborhood} query={query} />
                          </p>
                          {spot.vibes && spot.vibes.length > 0 && (
                            <div className="flex gap-1.5 mt-1.5">
                              {spot.vibes.slice(0, 3).map((vibe) => (
                                <span key={vibe} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                                  {vibe}
                                </span>
                              ))}
                            </div>
                          )}
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
          from { opacity: 0; transform: scale(0.98) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
