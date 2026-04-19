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

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    const tooltip = fullHint
      ? `Plan full (max ${ITINERARY_MAX_STOPS})`
      : inPlan
        ? "Remove from plan"
        : "Add to plan";
    return (
      <CardVariantButton
        tooltip={tooltip}
        ariaLabel={inPlan ? "Remove from plan" : "Add to plan"}
        inPlan={inPlan}
        fullHint={fullHint}
        onClick={handleClick}
      />
    );
  }

  if (variant === "icon") {
    // Inline SVG mirrors CheckInButton's 18px / r=10 geometry so the two
    // toolbar circles render at the exact same visible size. Same DOM in
    // both states lets the 45° rotation of the plus→× animate smoothly.
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={inPlan ? "Remove from plan" : "Add to plan"}
        aria-pressed={inPlan}
        data-tooltip={inPlan ? "Remove from plan" : "Add to plan"}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            strokeWidth="1.5"
            className={`transition-colors ${
              inPlan
                ? "fill-neutral-900 stroke-neutral-900 dark:fill-white dark:stroke-white"
                : "fill-none stroke-neutral-600 dark:stroke-neutral-300"
            }`}
          />
          <g
            className={`transition-transform duration-200 ${inPlan ? "rotate-45" : ""}`}
            style={{ transformOrigin: "12px 12px" }}
          >
            <path
              d="M8 12h8"
              strokeWidth="2"
              className={`transition-colors ${
                inPlan
                  ? "stroke-white dark:stroke-neutral-900"
                  : "stroke-neutral-600 dark:stroke-neutral-300"
              }`}
            />
            <path
              d="M12 8v8"
              strokeWidth="2"
              className={`transition-colors ${
                inPlan
                  ? "stroke-white dark:stroke-neutral-900"
                  : "stroke-neutral-600 dark:stroke-neutral-300"
              }`}
            />
          </g>
        </svg>
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

/** Card-variant with a portal-based hover tooltip. The card grid wraps
 *  cards in `rounded-2xl overflow-hidden`, which clips a `::after`
 *  pseudo-element tooltip — so we mount the label into `document.body`
 *  via createPortal and pin it with `position: fixed` using the
 *  button's bounding rect. Same behavior across every card-variant
 *  call site (city grid / wishlist / favorites / check-ins). */
function CardVariantButton({
  tooltip,
  ariaLabel,
  inPlan,
  fullHint,
  onClick,
}: {
  tooltip: string;
  ariaLabel: string;
  inPlan: boolean;
  fullHint: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Compute the portal coords at show time and pin until hide. Doing
  // this in the event handler avoids a `setState in effect` cascade.
  function show() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Anchor tooltip above the button, centered horizontally.
    setCoords({ top: r.top - 6, left: r.left + r.width / 2 });
  }
  function hide() {
    setCoords(null);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-label={ariaLabel}
        aria-pressed={inPlan}
        className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full border transition-colors ${
          inPlan
            ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
            : fullHint
              ? "bg-red-50 text-red-600 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"
              : "bg-surface border-neutral-600 text-neutral-600 dark:border-neutral-300 dark:text-neutral-300"
        }`}
      >
        <Plus
          size={10}
          strokeWidth={3}
          className={`transition-transform duration-200 ${inPlan ? "rotate-45" : ""}`}
        />
      </button>
      {coords && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                zIndex: 60,
                padding: "4px 10px",
                fontSize: "11px",
                fontFamily: "var(--font-calibre), system-ui, sans-serif",
                color: "white",
                background: "rgba(26, 26, 26, 0.75)",
                borderRadius: "999px",
                whiteSpace: "nowrap",
              }}
            >
              {tooltip}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
