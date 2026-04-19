"use client";

// Multi-select neighborhood popover for the itinerary planner's "Where"
// chip. Visually echoes CityClient's single-select dropdown (same card,
// same scroll behavior) but toggles a `Set` of selected names rather
// than replacing one active value, and exposes its selection back to
// the planner via `onChange`.
//
// Deliberately lives next to the planner rather than in a shared
// primitives folder — the CityClient dropdown is tangled enough with
// its other filters that extracting it wholesale would destabilize the
// city page. This component just mirrors the look.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface NeighborhoodPickerProps {
  /** Full list of selectable neighborhood names, in display order. */
  options: string[];
  /** Currently selected names. Order is preserved on toggle so the
   *  chip label renders in pick order. */
  value: string[];
  /** Invoked with the next selected list on each toggle. */
  onChange: (next: string[]) => void;
  /** Label when nothing is selected. Defaults to "Where". */
  emptyLabel?: string;
}

export default function NeighborhoodPicker({
  options,
  value,
  onChange,
  emptyLabel = "Where",
}: NeighborhoodPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape. Kept inline so the component is
  // self-contained — no shared hook dep.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedSet = new Set(value.map((v) => v.toLowerCase()));
  const activeCount = value.length;

  // Chip label: collapse to "N areas" once selection gets long so the
  // chip stays on one line in the criteria row.
  const chipLabel = (() => {
    if (activeCount === 0) return emptyLabel;
    if (activeCount === 1) return value[0];
    if (activeCount === 2) return value.join(", ");
    return `${activeCount} areas`;
  })();

  function toggle(name: string) {
    const key = name.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(value.filter((v) => v.toLowerCase() !== key));
    } else {
      onChange([...value, name]);
    }
  }

  function clearAll() {
    onChange([]);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
          activeCount > 0
            ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
            : "bg-surface text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
        }`}
      >
        <span>{chipLabel}</span>
        {activeCount > 0 ? (
          <X
            size={12}
            strokeWidth={2}
            className="opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          />
        ) : (
          <ChevronDown
            size={12}
            strokeWidth={1.75}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-56 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-72 animate-[fadeSlideDown_150ms_ease-out]">
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            {options.length === 0 && (
              <div className="px-4 py-3 text-xs text-neutral-400">
                No neighborhoods yet
              </div>
            )}
            {options.map((n) => {
              const isActive = selectedSet.has(n.toLowerCase());
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggle(n)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs transition-colors ${
                    isActive
                      ? "text-neutral-900 dark:text-white font-medium bg-ink-100"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {isActive && (
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{n}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {activeCount > 0 && (
            <div className="border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={clearAll}
                className="block w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors"
              >
                Clear areas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
