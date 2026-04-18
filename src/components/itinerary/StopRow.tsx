"use client";

// Single row in the planner's stop list. Extracted from
// `ItineraryPlanner.tsx` so the planner stays focused on layout + wiring
// and this component can grow in isolation (Reserve button, per-stop
// reactions in v2.1, drag affordances, etc.).
//
// All interactions are parent-driven — the row owns no state. dnd-kit
// still wires the drag handle; everything else is a plain callback.

import Link from "next/link";
import { Clock, ExternalLink, GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Spot } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { formatTime, toTimeInputValue } from "@/lib/itinerary-url";

export interface StopRowProps {
  spot: Spot;
  /** Zero-based position — displayed 1-indexed in the number badge. */
  position: number;
  /** Stored "HHMM" time (24h) or null for no time. */
  timeLabel: string | null;
  onRemove: () => void;
  /** Receives the raw `<input type="time">` value ("HH:MM"). */
  onTimeChange: (value: string) => void;
  /** Fires true on mouse enter, false on mouse leave — used by the
   *  planner to highlight the corresponding map pin. */
  onHover: (hovering: boolean) => void;
}

export default function StopRow({
  spot,
  position,
  timeLabel,
  onRemove,
  onTimeChange,
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
  const timeDisplay = formatTime(timeLabel);
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
      className="flex items-center gap-3 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
    >
      <button
        type="button"
        className="w-6 h-6 shrink-0 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reorder ${spot.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {/* Number badge — neutral, matches the map pin color. */}
      <div
        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold"
        aria-hidden="true"
      >
        {position + 1}
      </div>

      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          className="w-11 h-11 rounded-lg object-cover shrink-0 bg-neutral-100 dark:bg-neutral-800"
        />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <Link
          href={`/${citySlugFromName(spot.city)}/${spot.id}`}
          className="text-sm font-medium truncate hover:underline underline-offset-2 block"
        >
          {spot.name}
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="truncate">{spot.neighborhood}</span>
          {timeDisplay && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5">
                <Clock size={10} /> {timeDisplay}
              </span>
            </>
          )}
          {reserveUrl && (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={reserveUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
                aria-label={reserveLabel}
                title={reserveLabel}
              >
                Reserve
                <ExternalLink size={9} />
              </a>
            </>
          )}
        </div>
      </div>

      <input
        type="time"
        value={toTimeInputValue(timeLabel)}
        onChange={(e) => onTimeChange(e.target.value)}
        aria-label={`Time for ${spot.name}`}
        className="w-[6.5rem] shrink-0 bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
      />

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
