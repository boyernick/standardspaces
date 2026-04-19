"use client";

// Planner v2 criteria row — three chip-style popovers for when (date) /
// where (neighborhood) / what (activity). Each popover is inline,
// self-dismissing, and mutates exactly its slice of criteria state via
// the parent-supplied `onChange*` callbacks.
//
// The row is presentational — no localStorage writes, no server calls.
// Persistence is the planner's job; this component only knows how to
// render + toggle.
//
// Style note: the chips mirror CityClient's filter pills (rounded-full,
// active = inverted surface). A selected chip shows a compact summary
// ("Dinner, Drinks" / "May 2") so at a glance the user sees the current
// filter state without expanding any popover.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ACTIVITIES, ACTIVITIES_BY_ID, type Activity } from "@/lib/types";
import NeighborhoodPicker from "./NeighborhoodPicker";

export interface CriteriaRowProps {
  /** ISO yyyy-mm-dd, or null when unset. */
  date: string | null;
  onDateChange: (date: string | null) => void;

  /** Selected `Activity.id` values. */
  activities: string[];
  onActivitiesChange: (next: string[]) => void;

  /** Options + selection for the Where chip. */
  neighborhoodOptions: string[];
  neighborhoods: string[];
  onNeighborhoodsChange: (next: string[]) => void;
}

/** How many activity chips feel like a single evening. More is allowed
 *  by the UI but the badge turns to a count rather than a label run. */
const MAX_ACTIVITIES_ON_LABEL = 2;

export default function CriteriaRow({
  date,
  onDateChange,
  activities,
  onActivitiesChange,
  neighborhoodOptions,
  neighborhoods,
  onNeighborhoodsChange,
}: CriteriaRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DateChip value={date} onChange={onDateChange} />
      <NeighborhoodPicker
        options={neighborhoodOptions}
        value={neighborhoods}
        onChange={onNeighborhoodsChange}
      />
      <ActivityChip value={activities} onChange={onActivitiesChange} />
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Shared popover shell
 * ------------------------------------------------------------------ */

/** Tiny generic popover: click-trigger button, outside-click + Escape
 *  dismiss, anchored below the trigger. Keeps DateChip and ActivityChip
 *  visually consistent. */
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
          className={`absolute z-40 mt-1.5 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden animate-[fadeSlideDown_150ms_ease-out] ${
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
 * Date chip — "When"
 * ------------------------------------------------------------------ */

function DateChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? formatDateLabel(value) : "When";
  const active = !!value;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="p-3 w-72"
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
          <span>{label}</span>
          {active ? (
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
          ) : (
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
      }
    >
      <Calendar
        value={value}
        onChange={(next) => {
          onChange(next);
          if (next) setOpen(false);
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          Clear date
        </button>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------------
 * Calendar — custom month-view picker used inside the Date popover.
 *
 * Why not `<input type="date">`? The native picker is platform-themed
 * (Chrome blue focus ring, Safari sheet, Firefox modal), which doesn't
 * match the rest of the criteria row. A hand-rolled grid is only a few
 * dozen lines and lets the selected/today states use the same
 * inverted-surface tokens the rest of the app's active states use.
 * ------------------------------------------------------------------ */

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function Calendar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  // View-month state seeds from `value` if set, otherwise today. We keep
  // it local so paging through months doesn't mutate the selection.
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) {
      const d = parseISODate(value);
      if (d) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Build a 6×7 grid starting on the Sunday on/before the 1st. Days
  // from the neighboring months are dimmed but still pickable — picking
  // one just advances the view.
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }

  const todayKey = toISODate(new Date());
  const selectedKey = value;

  return (
    <div>
      {/* Month nav row */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-ink-100 transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
        </button>
        <div className="text-sm font-medium">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-ink-100 transition-colors"
        >
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Weekday header — single letter; position carries the meaning. */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_INITIALS.map((d, i) => (
          <div
            key={i}
            className="h-7 flex items-center justify-center text-[10px] text-neutral-400 dark:text-neutral-600"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const key = toISODate(c.date);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(key)}
              aria-label={c.date.toDateString()}
              aria-pressed={isSelected}
              className={`h-9 text-xs rounded-full transition-colors ${
                isSelected
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                  : !c.inMonth
                    ? "text-neutral-300 dark:text-neutral-700 hover:bg-ink-100"
                    : isToday
                      ? "text-neutral-900 dark:text-white font-medium ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700 hover:bg-ink-100"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-ink-100"
              }`}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Parse an `yyyy-mm-dd` string into a local-time `Date`, or null. */
function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a local-time `Date` as `yyyy-mm-dd`. Avoids `toISOString()`
 *  which would shift across UTC for late-evening timezones. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
      className="w-56 flex flex-col max-h-72"
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
          <span className="truncate max-w-[12rem]">{label}</span>
          {active ? (
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
          ) : (
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {ACTIVITIES.map((a) => {
          const isOn = value.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs transition-colors ${
                isOn
                  ? "text-neutral-900 dark:text-white font-medium bg-ink-100"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100"
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    isOn
                      ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                >
                  {isOn && (
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
                <span className="truncate">{a.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      {active && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            className="block w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors"
          >
            Clear activities
          </button>
        </div>
      )}
    </Popover>
  );
}

