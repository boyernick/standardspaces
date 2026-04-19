"use client";

// Single row in the planner's stop list. Extracted from
// `ItineraryPlanner.tsx` so the planner stays focused on layout + wiring
// and this component can grow in isolation (Reserve button, per-stop
// reactions in v2.1, drag affordances, etc.).
//
// All interactions are parent-driven — the row owns no state. dnd-kit
// still wires the drag handle; everything else is a plain callback.

import Link from "next/link";
import { GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Spot } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";

export interface StopRowProps {
  spot: Spot;
  /** Zero-based position — displayed 1-indexed in the number badge. */
  position: number;
  onRemove: () => void;
  /** Fires true on mouse enter, false on mouse leave — used by the
   *  planner to highlight the corresponding map pin. */
  onHover: (hovering: boolean) => void;
}

export default function StopRow({
  spot,
  position,
  onRemove,
  onHover,
}: StopRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: spot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const thumbnail = spot.images?.[0];
  const reserveUrl = spot.bookingUrl?.trim();
  const reserveLabel = spot.bookingPlatform
    ? `Reserve on ${spot.bookingPlatform}`
    : "Reserve";

  return (
    <li
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="flex items-center gap-2.5 pl-1.5 pr-2 py-4 bg-surface"
    >
      <button
        type="button"
        className="w-5 h-6 shrink-0 flex items-center justify-center text-neutral-300 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-grab active:cursor-grabbing touch-none transition-colors"
        aria-label={`Reorder ${spot.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} strokeWidth={1.75} />
      </button>

      {/* Thumbnail + stop-number corner pin read as one unit — matches
       *  the city-page tray's row design. The surface-colored ring around
       *  the pin gives it a sticker effect so the badge is readable
       *  against any photo. */}
      <div className="relative w-10 h-10 shrink-0">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full rounded-lg object-cover bg-neutral-100 dark:bg-neutral-800"
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        )}
        <div
          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold ring-2 ring-[var(--color-surface)]"
          aria-hidden="true"
        >
          {position + 1}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/${citySlugFromName(spot.city)}/${spot.id}`}
          className="text-sm font-medium truncate leading-tight hover:underline underline-offset-2 block"
        >
          {spot.name}
        </Link>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-tight mt-0.5">
          <span>{spot.neighborhood}</span>
          {reserveUrl && (
            <>
              {" · "}
              <a
                href={reserveUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
                aria-label={reserveLabel}
                title={reserveLabel}
              >
                Reserve
              </a>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${spot.name}`}
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <X size={14} />
      </button>
    </li>
  );
}
