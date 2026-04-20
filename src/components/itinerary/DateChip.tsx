"use client";

// Chip-style date picker used by the saved-plan editor's "Date" section.
// Clicking the chip opens a custom month-view Calendar popover; picking
// a day closes the popover and fires `onChange`. Clearing is a small
// text link inside the popover plus the inline X on the active chip.
//
// Extracted from the old planner's CriteriaRow so the saved-plan editor
// can reuse the pattern without dragging the whole criteria surface
// (activities / neighborhoods / vibes — all dropped on the polish page).
//
// Why a hand-rolled picker and not `<input type="date">`? The native
// picker is platform-themed (Chrome blue focus ring, Safari sheet,
// Firefox modal), which doesn't match the rest of the app. A custom
// grid is only a few dozen lines and lets selected/today states use the
// same inverted-surface tokens the rest of the app's active states use.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

/* ---------------------------------------------------------------------
 * Chip trigger
 * ------------------------------------------------------------------ */

export function DateChip({
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
 * Popover shell — click-trigger + outside-click / Escape dismiss.
 * ------------------------------------------------------------------ */

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
 * Calendar — 6×7 month grid.
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

/* ---------------------------------------------------------------------
 * Date helpers — local-time only so late-evening picks don't drift UTC.
 * ------------------------------------------------------------------ */

function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** "Today" / "Tomorrow" / "Sat May 2". Falls back to "Pick a date" on
 *  parse failure. */
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
