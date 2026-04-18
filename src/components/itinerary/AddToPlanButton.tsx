"use client";

// Per-card "+ / ✓" toggle that adds a space to the current city's
// itinerary draft. Mirrors FavoriteButton's shape (icon-sized, stops
// click propagation so the surrounding Link doesn't navigate). The
// action is local-only — draft state lives in localStorage via
// `useItineraryDraft`, which the tray also reads.
//
// Variants:
//   - `card`: compact circle with just a plus icon, sized to live
//             next to a card title (replacing the NewBadge slot).
//   - `chip`: pill with "+ Add" / "✓ In plan" label, floats over
//             an image corner.
//   - `icon`: transparent 40×40 hit target for inline toolbars.
//
// Capacity: `add` returns false when the draft already has
// ITINERARY_MAX_STOPS items; we surface a lightweight inline hint
// rather than importing a full toast system for a single message.

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import { ITINERARY_MAX_STOPS } from "@/lib/types";

export default function AddToPlanButton({
  spotId,
  citySlug,
  variant = "chip",
}: {
  spotId: string;
  citySlug: string;
  variant?: "chip" | "icon" | "card";
}) {
  const { has, add, remove } = useItineraryDraft(citySlug);
  const inPlan = has(spotId);
  const [flash, setFlash] = useState<"full" | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inPlan) {
      remove(spotId);
      return;
    }
    const ok = add(spotId);
    if (!ok) {
      setFlash("full");
      setTimeout(() => setFlash(null), 1800);
    }
  }

  if (variant === "card") {
    const fullHint = flash === "full";
    const title = fullHint
      ? `Plan is full (max ${ITINERARY_MAX_STOPS})`
      : inPlan
        ? "In your plan — tap to remove"
        : "Add to plan";
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={inPlan ? "Remove from plan" : "Add to plan"}
        aria-pressed={inPlan}
        title={title}
        className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full border transition-colors ${
          inPlan
            ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
            : fullHint
              ? "bg-red-50 text-red-600 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"
              : "bg-surface border-neutral-600 text-neutral-600 dark:border-neutral-300 dark:text-neutral-300"
        }`}
      >
        <Plus size={10} strokeWidth={3} />
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={inPlan ? "Remove from plan" : "Add to plan"}
        aria-pressed={inPlan}
        data-tooltip={inPlan ? "In plan" : "Add to plan"}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <span
          className={`w-[18px] h-[18px] flex items-center justify-center rounded-full border transition-colors ${
            inPlan
              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
              : "border-neutral-600 text-neutral-600 dark:border-neutral-300 dark:text-neutral-300"
          }`}
        >
          <Plus size={10} strokeWidth={3} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inPlan ? "Remove from plan" : "Add to plan"}
      aria-pressed={inPlan}
      className={`inline-flex items-center gap-1 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium pl-2 pr-2.5 py-1 transition-colors ${
        inPlan
          ? "bg-neutral-900/90 text-white dark:bg-white/90 dark:text-neutral-900"
          : "bg-white/90 text-neutral-900 hover:bg-white dark:bg-neutral-900/80 dark:text-white dark:hover:bg-neutral-900"
      }`}
    >
      {inPlan ? <Check size={13} strokeWidth={2.25} /> : <Plus size={13} strokeWidth={2.25} />}
      <span>{inPlan ? "In plan" : flash === "full" ? `Max ${ITINERARY_MAX_STOPS}` : "Add"}</span>
    </button>
  );
}
