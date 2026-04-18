"use client";

// Planner v2 criteria row — four chip-style popovers for date / activity
// (what) / vibe (feel) / neighborhood (where). Each popover is inline,
// self-dismissing, and mutates exactly its slice of criteria state via
// the parent-supplied `onChange*` callbacks.
//
// The row is presentational — no localStorage writes, no server calls.
// Persistence is the planner's job; this component only knows how to
// render + toggle.
//
// Style note: the chips mirror CityClient's filter pills (rounded-full,
// active = inverted surface). A selected chip shows a compact summary
// ("Dinner, Drinks" / "3 moods" / "May 2") so at a glance the user sees
// the current filter state without expanding any popover.

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import {
  ACTIVITIES,
  ACTIVITIES_BY_ID,
  TOP_VIBES,
  VIBE_MOODS,
  type Activity,
} from "@/lib/types";
import NeighborhoodPicker from "./NeighborhoodPicker";

export interface CriteriaRowProps {
  /** ISO yyyy-mm-dd, or null when unset. */
  date: string | null;
  onDateChange: (date: string | null) => void;

  /** Selected `Activity.id` values. */
  activities: string[];
  onActivitiesChange: (next: string[]) => void;

  /** Selected vibes from `VIBE_MOODS`. */
  vibes: string[];
  onVibesChange: (next: string[]) => void;

  /** Options + selection for the Where chip. */
  neighborhoodOptions: string[];
  neighborhoods: string[];
  onNeighborhoodsChange: (next: string[]) => void;

  /** Optional per-neighborhood count for the picker. */
  neighborhoodCounts?: Record<string, number>;
}

/** How many activity chips feel like a single evening. More is allowed
 *  by the UI but the badge turns to a count rather than a label run. */
const MAX_ACTIVITIES_ON_LABEL = 2;

export default function CriteriaRow({
  date,
  onDateChange,
  activities,
  onActivitiesChange,
  vibes,
  onVibesChange,
  neighborhoodOptions,
  neighborhoods,
  onNeighborhoodsChange,
  neighborhoodCounts,
}: CriteriaRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DateChip value={date} onChange={onDateChange} />
      <ActivityChip value={activities} onChange={onActivitiesChange} />
      <VibeChip value={vibes} onChange={onVibesChange} />
      <NeighborhoodPicker
        options={neighborhoodOptions}
        value={neighborhoods}
        onChange={onNeighborhoodsChange}
        counts={neighborhoodCounts}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Shared popover shell
 * ------------------------------------------------------------------ */

/** Tiny generic popover: click-trigger button, outside-click + Escape
 *  dismiss, anchored below the trigger. Keeps DateChip / ActivityChip /
 *  VibeChip visually consistent. */
function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "left",
  className,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);
  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger}
      {open && (
        <div
          className={`absolute z-40 mt-1.5 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg overflow-hidden animate-[fadeSlideDown_150ms_ease-out] ${
            align === "right" ? "right-0" : "left-0"
          } top-full ${className ?? ""}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Date chip
 * ------------------------------------------------------------------ */

function DateChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? formatDateLabel(value) : "Pick a date";
  const active = !!value;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="p-3 w-[16rem]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
            active
              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
              : "bg-surface text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
          }`}
        >
          <CalendarIcon size={12} strokeWidth={1.75} />
          <span>{label}</span>
          {active && (
            <X
              size={12}
              strokeWidth={2}
              className="opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
            />
          )}
        </button>
      }
    >
      <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
        Date
      </label>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
        }}
        className="w-full bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          Clear date
        </button>
      )}
    </Popover>
  );
}

/** "Sat May 2" / "Today" / "Tomorrow" — short, lower density than the
 *  full ISO. Falls back to "Pick a date" on parse failure. */
function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Pick a date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ---------------------------------------------------------------------
 * Activity chip — "What"
 * ------------------------------------------------------------------ */

function ActivityChip({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const resolved: Activity[] = value
    .map((id) => ACTIVITIES_BY_ID[id])
    .filter(Boolean);
  const label = (() => {
    if (!resolved.length) return "What";
    if (resolved.length <= MAX_ACTIVITIES_ON_LABEL) {
      return resolved.map((a) => a.label).join(", ");
    }
    return `${resolved.length} activities`;
  })();
  const active = resolved.length > 0;

  function toggle(id: string) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    // Preserve order by the canonical ACTIVITIES list — gives the label
    // a consistent reading order (Brunch, Lunch, Dinner, Drinks…).
    onChange(ACTIVITIES.filter((a) => set.has(a.id)).map((a) => a.id));
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="p-2 w-[22rem]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
            active
              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
              : "bg-surface text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
          }`}
        >
          <Utensils size={12} strokeWidth={1.75} />
          <span className="truncate max-w-[12rem]">{label}</span>
          {active && (
            <X
              size={12}
              strokeWidth={2}
              className="opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
                setOpen(false);
              }}
            />
          )}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        {ACTIVITIES.map((a) => {
          const isOn = value.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                isOn
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                  : "bg-surface text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
              }`}
            >
              <span>{a.label}</span>
              {isOn && (
                <svg
                  width="10"
                  height="10"
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
            </button>
          );
        })}
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setOpen(false);
          }}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          Clear activities
        </button>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------------
 * Vibe chip — "Feel"
 * ------------------------------------------------------------------ */

function VibeChip({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value.length > 0;
  const label = (() => {
    if (!active) return "Feel";
    if (value.length === 1) return value[0];
    if (value.length === 2) return value.join(", ");
    return `${value.length} moods`;
  })();

  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  // Show TOP_VIBES first, then the remainder. TOP_VIBES is curated for
  // the quick-glance case (Rooftop, Outdoor, Live music, etc.) — we
  // intersect with VIBE_MOODS so the promoted vibes never leak
  // occasion-shaped entries that ACTIVITIES already covers.
  const moodSet = new Set(VIBE_MOODS);
  const promoted = TOP_VIBES.filter((v) => moodSet.has(v));
  const promotedSet = new Set(promoted);
  const rest = VIBE_MOODS.filter((v) => !promotedSet.has(v));

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="p-3 w-[22rem] max-h-[22rem] overflow-y-auto"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
            active
              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
              : "bg-surface text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
          }`}
        >
          <Sparkles size={12} strokeWidth={1.75} />
          <span className="truncate max-w-[10rem]">{label}</span>
          {active && (
            <X
              size={12}
              strokeWidth={2}
              className="opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
                setOpen(false);
              }}
            />
          )}
        </button>
      }
    >
      {promoted.length > 0 && (
        <>
          <div className="text-[11px] font-medium text-neutral-400 mb-1.5">
            Popular
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {promoted.map((v) => (
              <VibePill
                key={v}
                label={v}
                isOn={value.includes(v)}
                onToggle={() => toggle(v)}
              />
            ))}
          </div>
        </>
      )}
      <div className="text-[11px] font-medium text-neutral-400 mb-1.5">
        All moods
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rest.map((v) => (
          <VibePill
            key={v}
            label={v}
            isOn={value.includes(v)}
            onToggle={() => toggle(v)}
          />
        ))}
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setOpen(false);
          }}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          Clear vibes
        </button>
      )}
    </Popover>
  );
}

function VibePill({
  label,
  isOn,
  onToggle,
}: {
  label: string;
  isOn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
        isOn
          ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
          : "bg-surface text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
      }`}
    >
      {label}
    </button>
  );
}
