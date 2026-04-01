"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { spots } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ORDER, Category } from "@/lib/types";
import { Search } from "lucide-react";

// Group results by category
function groupByCategory(items: typeof spots) {
  const grouped = new globalThis.Map<Category, typeof spots>();
  for (const spot of items) {
    const list = grouped.get(spot.category) || [];
    list.push(spot);
    grouped.set(spot.category, list);
  }
  // Return in category order
  return CATEGORY_ORDER
    .filter((c) => grouped.has(c))
    .map((c) => ({ category: c, spots: grouped.get(c)! }));
}

// Highlight matching text
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
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    if (!query.trim()) return spots;
    const q = query.toLowerCase();
    return spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => groupByCategory(results), [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(
    () => grouped.flatMap((g) => g.spots),
    [grouped]
  );

  // Keyboard shortcut to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      e.preventDefault();
      navigate(flatResults[selectedIndex].id);
    }
  }

  function navigate(id: string) {
    setOpen(false);
    const spot = spots.find((s) => s.id === id);
    if (spot) {
      router.push(`/${spot.city.toLowerCase()}/${spot.id}`);
    }
  }

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] md:pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-xl mx-4 md:mx-0 bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "command-in 0.15s ease-out",
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 md:px-5 border-b border-neutral-100 dark:border-neutral-800">
          <Search size={18} strokeWidth={2} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Where do you want to go?"
            className="flex-1 py-4 text-sm bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-500 dark:text-white"
          />
          <kbd className="text-[10px] text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {flatResults.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No spaces found</p>
              <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">
                Try a different name, neighborhood, or category
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div className="px-5 pt-3 pb-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                </div>

                {/* Spots in category */}
                {group.spots.map((spot) => {
                  const thisIndex = flatIndex++;
                  const isSelected = thisIndex === selectedIndex;

                  return (
                    <button
                      key={spot.id}
                      data-selected={isSelected}
                      onClick={() => navigate(spot.id)}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                      className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                        isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-neutral-700 dark:text-neutral-200">
                          <Highlight text={spot.name} query={query} />
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                          <Highlight text={spot.neighborhood} query={query} />
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-neutral-300 dark:text-neutral-600 shrink-0">
                          ↵ open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-5 py-2.5 flex items-center gap-4 text-[10px] text-neutral-400 dark:text-neutral-500">
          <span className="flex items-center gap-1">
            <kbd className="border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5">↑</kbd>
            <kbd className="border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5">esc</kbd>
            close
          </span>
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
