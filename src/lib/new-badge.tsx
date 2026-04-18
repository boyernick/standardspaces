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
  /** Tighter padding for image-overlay placements (e.g. profile tiles). */
  compact?: boolean;
  className?: string;
}

export function NewBadge({ spot, compact = false, className = "" }: NewBadgeProps) {
  if (!isSpotNew(spot)) return null;
  return (
    <span
      className={`shrink-0 ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      } font-semibold rounded-full border border-neutral-200 dark:border-neutral-800 bg-surface text-neutral-900 dark:text-white shadow-[0_1px_5px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.4)] ${className}`}
    >
      New
    </span>
  );
}
