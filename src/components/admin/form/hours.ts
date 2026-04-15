// Hours-string parse/serialize used by both admin forms (Review and Edit)
// and consumed by the public page's "Open now" logic. The string round-trips
// through formats like "Daily 5PM–11PM", "Mon–Fri 11AM–10PM", and mixed
// "Mon 11AM–10PM, Sat–Sun 10AM–11PM".

import { DAYS } from "./constants";

export interface TimeBlock {
  open: string;
  close: string;
}

export interface DayHours {
  closed: boolean;
  blocks: TimeBlock[];
}

export function parseHoursString(str: string): Record<string, DayHours> {
  const defaults: Record<string, DayHours> = {};
  for (const d of DAYS) {
    defaults[d] = { closed: false, blocks: [{ open: "11:00", close: "23:00" }] };
  }
  if (str && str.trim()) {
    const timeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (timeMatch) {
      const block = { open: to24(timeMatch[1]), close: to24(timeMatch[2]) };
      for (const d of DAYS) {
        defaults[d] = { closed: false, blocks: [block] };
      }
    }
  }
  return defaults;
}

function to24(t: string): string {
  t = t.trim().toUpperCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return "12:00";
  let h = parseInt(m[1]);
  const min = m[2] || "00";
  const ampm = m[3];
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${min}`;
}

function fmt(t: string): string {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === "00" ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

function fmtBlocks(blocks: TimeBlock[]): string {
  return blocks.map((b) => `${fmt(b.open)}–${fmt(b.close)}`).join(", ");
}

function blocksEqual(a: TimeBlock[], b: TimeBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ab, i) => ab.open === b[i].open && ab.close === b[i].close);
}

function getRanges(entries: { day: string; closed: boolean }[]): string {
  const open = entries.filter((e) => !e.closed);
  if (open.length === 0) return "";
  if (open.length === 7) return "Mon–Sun";
  const dayIndices = open.map((e) => DAYS.indexOf(e.day as typeof DAYS[number]));
  const ranges: string[] = [];
  let start = dayIndices[0];
  let end = dayIndices[0];
  for (let i = 1; i < dayIndices.length; i++) {
    if (dayIndices[i] === end + 1) {
      end = dayIndices[i];
    } else {
      ranges.push(start === end ? DAYS[start] : `${DAYS[start]}–${DAYS[end]}`);
      start = dayIndices[i];
      end = dayIndices[i];
    }
  }
  ranges.push(start === end ? DAYS[start] : `${DAYS[start]}–${DAYS[end]}`);
  return ranges.join(", ");
}

export function hoursToString(hours: Record<string, DayHours>): string {
  const entries = DAYS.map((d) => ({ day: d, ...hours[d] }));
  const openDays = entries.filter((e) => !e.closed);
  if (openDays.length === 0) return "Closed";
  const allSame = openDays.every((d) => blocksEqual(d.blocks, openDays[0].blocks));
  if (allSame && openDays.length === 7) {
    return `Daily ${fmtBlocks(openDays[0].blocks)}`;
  }
  if (allSame) {
    const ranges = getRanges(entries);
    return `${ranges} ${fmtBlocks(openDays[0].blocks)}`;
  }
  return entries
    .filter((e) => !e.closed)
    .map((e) => `${e.day} ${fmtBlocks(e.blocks)}`)
    .join(", ");
}
