"use client";

// Sticky bottom tray that surfaces the current draft itinerary on any
// city page. Appears when the draft has at least one stop; tapping the
// bar routes into /[city]/itinerary, tapping the X resets the draft.
// Designed to sit above the existing mobile view-toggle bar (extra
// bottom padding at the `split:` breakpoint compensates for CityClient's
// map/list toggle).

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, ListOrdered } from "lucide-react";
import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import { ITINERARY_MAX_STOPS, type Spot } from "@/lib/types";

// Same inset from viewport bottom as the map view's bottom controls (and
// the mobile bottom bar on CityClient). Callers can override via
// `bottomOffset`, but the default keeps the tray anchored consistently
// across pages so it doesn't drift between surfaces.
const DEFAULT_BOTTOM_OFFSET = 16;

export default function ItineraryTray({
  citySlug,
  spots,
  /** Extra bottom offset (px) added on top of the default. Callers like
   *  CityClient pass this to clear their mobile bottom bar. */
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
}: {
  citySlug: string;
  spots: Spot[];
  bottomOffset?: number;
}) {
  const { draft, clear } = useItineraryDraft(citySlug);

  // Resolve the Spot records for each draft item so we can render their
  // images as an overlapping avatar stack and their names as an arrow-
  // joined sequence. Missing spots are silently dropped.
  const planStops = useMemo(
    () => draft.items
      .map((it) => spots.find((s) => s.id === it.spotId))
      .filter((s): s is Spot => !!s),
    [draft.items, spots],
  );

  // Cap the avatar stack at three circles — the text summary already
  // carries the full sequence and count, so more avatars would just add
  // width without information.
  const visibleStops = planStops.slice(0, 3);

  // "Space A → Space B → Space C". `truncate` on the line trims the tail
  // when it overflows; that's preferable to dropping names up front,
  // since the first stop is usually the most anchoring.
  const summary = planStops.map((s) => s.name).join(" → ");

  const count = draft.items.length;
  const show = count > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="itinerary-tray"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          // Below the split breakpoint, use the caller-provided offset
          // (CityClient passes 72 to clear its mobile search/toggle bar).
          // At split+ there's no mobile bottom bar, so pin the tray close
          // to the viewport bottom — matching the map view's 16px inset.
          // Both values add safe-area-inset-bottom so the tray clears the
          // iOS home indicator.
          style={{ "--tray-bottom": `${bottomOffset}px` } as React.CSSProperties}
          className="fixed left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none bottom-[calc(var(--tray-bottom)+env(safe-area-inset-bottom,0px))] split:bottom-[calc(16px+env(safe-area-inset-bottom,0px))]"
        >
          <div className="mx-auto max-w-sm pointer-events-auto">
            <div className="flex items-center gap-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.4)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.75)] p-2">
              <Link
                href={`/${citySlug}/itinerary`}
                aria-label="Open planner"
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                {visibleStops.length > 0 ? (
                  <div className="flex shrink-0 items-center">
                    {visibleStops.map((s, i) =>
                      s.images?.[0] ? (
                        <img
                          key={s.id}
                          src={s.images[0]}
                          alt=""
                          className={`w-8 h-8 rounded-full object-cover border-2 border-white dark:border-neutral-900 ${i > 0 ? "-ml-4" : ""}`}
                        />
                      ) : (
                        <div
                          key={s.id}
                          className={`w-8 h-8 rounded-full bg-white/10 dark:bg-neutral-900/10 flex items-center justify-center border-2 border-white dark:border-neutral-900 ${i > 0 ? "-ml-4" : ""}`}
                        >
                          <ListOrdered size={14} className="opacity-80" />
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 dark:bg-neutral-900/10 shrink-0 flex items-center justify-center border-2 border-white dark:border-neutral-900">
                    <ListOrdered size={14} className="opacity-80" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate leading-tight">
                    {count} {count === 1 ? "stop" : "stops"} in the plan
                  </div>
                  <div className="text-[11px] opacity-70 truncate leading-tight">
                    {summary}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={clear}
                aria-label="Clear plan"
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center hover:bg-white/10 dark:hover:bg-neutral-900/10 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            {count >= ITINERARY_MAX_STOPS && (
              <div className="mt-1.5 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                Plan is full ({ITINERARY_MAX_STOPS} max). Open the planner
                to reorder or remove stops.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
