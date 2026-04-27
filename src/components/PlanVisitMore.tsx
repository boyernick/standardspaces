"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible wrapper for the "less-critical" entries in a space's Plan
 * your visit grid (price, website, Instagram, phone, dress code, parking,
 * reservations copy). The three highest-signal facts — Book, Menu, Hours
 * — live outside this component and always render.
 *
 * Kept deliberately dumb: the parent decides *which* cells live inside
 * and *which* stay outside. We just provide the toggle + grid chrome so
 * the collapsed items slot into the same 2/3-column layout as the
 * always-visible row above.
 */
export default function PlanVisitMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6 mt-6">
          {children}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-6 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      >
        {open ? "See less" : "See more"}
      </button>
    </>
  );
}
