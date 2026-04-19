import type { Spot } from "./types";

/**
 * A space stays "new" for 7 days from the moment an admin flips its
 * `markedNewAt` toggle. After the window elapses the badge auto-hides at
 * render time — no background job, no cron. Admin can re-toggle to restart
 * the clock.
 */
export const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isSpotNew(spot: Pick<Spot, "markedNewAt">): boolean {
  if (!spot.markedNewAt) return false;
  const t = new Date(spot.markedNewAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_WINDOW_MS;
}

interface NewBadgeProps {
  spot: Pick<Spot, "markedNewAt">;
  /** Tighter padding for dense inline placements (e.g. profile tiles, command menu rows). */
  compact?: boolean;
  /**
   * When true, absolute-positions the badge at top-left — intended for
   * cards where the parent is `relative` and wraps an image carousel.
   * Adds a slightly stronger shadow so the pill reads cleanly over any
   * photo, light or dark.
   */
  overlay?: boolean;
  className?: string;
}

export function NewBadge({ spot, compact = false, overlay = false, className = "" }: NewBadgeProps) {
  if (!isSpotNew(spot)) return null;
  const position = overlay ? "absolute top-2 left-2 z-10 " : "";
  const size = compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  // Pill background tracks `--color-surface` so it reads as a "lifted
  // chip" of the page itself rather than a bright sticker. Shadow does
  // the separation work; dark-mode text flips so the pill stays legible
  // when surface is near-black.
  const shadow = overlay
    ? "shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
    : "shadow-[0_2px_8px_rgba(0,0,0,0.14)]";
  return (
    <span
      className={`${position}shrink-0 ${size} font-semibold rounded-full bg-surface text-neutral-900 dark:text-white ${shadow} ${className}`}
    >
      New
    </span>
  );
}
