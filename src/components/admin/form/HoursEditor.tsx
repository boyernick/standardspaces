"use client";

import { ChevronsDown, X } from "lucide-react";
import { DAYS } from "./constants";
import type { DayHours, TimeBlock } from "./hours";

// Hours editor shared by the admin Review and Edit forms. Each day has 1–N
// time blocks (Mon 11AM–2PM, 5PM–11PM), a Closed toggle, and a chevron
// that copies the current day's hours to all days below it — useful when
// the scraper got one day right and the rest need to match.

export function HoursEditor({
  hours,
  onChange,
}: {
  hours: Record<string, DayHours>;
  onChange: (h: Record<string, DayHours>) => void;
}) {
  const timeInputClass =
    "px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-surface focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

  function updateBlock(day: string, blockIndex: number, patch: Partial<TimeBlock>) {
    const blocks = hours[day].blocks.map((b, i) => (i === blockIndex ? { ...b, ...patch } : b));
    onChange({ ...hours, [day]: { ...hours[day], blocks } });
  }

  function addBlock(day: string) {
    const lastBlock = hours[day].blocks[hours[day].blocks.length - 1];
    const newBlock = { open: lastBlock?.close || "18:00", close: "23:00" };
    onChange({ ...hours, [day]: { ...hours[day], blocks: [...hours[day].blocks, newBlock] } });
  }

  function removeBlock(day: string, blockIndex: number) {
    const blocks = hours[day].blocks.filter((_, i) => i !== blockIndex);
    onChange({
      ...hours,
      [day]: { ...hours[day], blocks: blocks.length > 0 ? blocks : [{ open: "11:00", close: "23:00" }] },
    });
  }

  function toggleClosed(day: string) {
    onChange({ ...hours, [day]: { ...hours[day], closed: !hours[day].closed } });
  }

  function copyToRest(day: string) {
    const idx = DAYS.indexOf(day as typeof DAYS[number]);
    if (idx < 0 || idx === DAYS.length - 1) return;
    const src = hours[day];
    const next = { ...hours };
    for (let i = idx + 1; i < DAYS.length; i++) {
      next[DAYS[i]] = {
        closed: src.closed,
        blocks: src.blocks.map((b) => ({ ...b })),
      };
    }
    onChange(next);
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {DAYS.map((day, i) => (
        <div
          key={day}
          className={`px-4 py-2.5 ${i > 0 ? "border-t border-neutral-100 dark:border-neutral-800" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-sm font-medium w-8 shrink-0 pt-1">{day}</span>
            {hours[day].closed ? (
              <span className="text-sm text-neutral-400 dark:text-neutral-500 flex-1 pt-1">Closed</span>
            ) : (
              <div className="flex-1 space-y-1.5">
                {hours[day].blocks.map((block, bi) => (
                  <div key={bi} className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={block.open}
                      onChange={(e) => updateBlock(day, bi, { open: e.target.value })}
                      className={timeInputClass}
                    />
                    <span className="text-neutral-400 text-xs">to</span>
                    <input
                      type="time"
                      value={block.close}
                      onChange={(e) => updateBlock(day, bi, { close: e.target.value })}
                      className={timeInputClass}
                    />
                    {hours[day].blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(day, bi)}
                        className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove this time block"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => toggleClosed(day)}
                className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                {hours[day].closed ? "Open" : "Closed"}
              </button>
              {!hours[day].closed && (
                <button
                  type="button"
                  onClick={() => addBlock(day)}
                  title="Add another time block (e.g. lunch + dinner)"
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  Add block
                </button>
              )}
              <button
                type="button"
                onClick={() => copyToRest(day)}
                title="Apply these hours to the remaining days"
                aria-hidden={i === DAYS.length - 1}
                tabIndex={i === DAYS.length - 1 ? -1 : 0}
                className={`text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors ${
                  i === DAYS.length - 1 ? "invisible pointer-events-none" : ""
                }`}
              >
                <ChevronsDown size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
