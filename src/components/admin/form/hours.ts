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

// Matches any day label Perplexity or admins might emit: "Monday",
// "Mon", "Daily", or a range like "Mon–Fri" / "Monday–Friday".
const DAY_LABEL_PAT =
  "(?:Daily|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)";
const DAY_LABEL_RANGE_PAT = `${DAY_LABEL_PAT}(?:\\s*[-–]\\s*${DAY_LABEL_PAT})?`;

const DAY_KEY: Record<string, typeof DAYS[number]> = {
  monday: "Mon", mon: "Mon",
  tuesday: "Tue", tue: "Tue",
  wednesday: "Wed", wed: "Wed",
  thursday: "Thu", thu: "Thu",
  friday: "Fri", fri: "Fri",
  saturday: "Sat", sat: "Sat",
  sunday: "Sun", sun: "Sun",
};

function expandDayRange(from: typeof DAYS[number], to: typeof DAYS[number]): typeof DAYS[number][] {
  const i = DAYS.indexOf(from);
  const j = DAYS.indexOf(to);
  if (i < 0 || j < 0) return [];
  // Handles forward ranges and Fri–Mon style wraparounds alike.
  if (i <= j) return DAYS.slice(i, j + 1) as unknown as typeof DAYS[number][];
  return [...DAYS.slice(i), ...DAYS.slice(0, j + 1)] as unknown as typeof DAYS[number][];
}

export function parseHoursString(str: string): Record<string, DayHours> {
  const result: Record<string, DayHours> = {};
  for (const d of DAYS) {
    result[d] = { closed: false, blocks: [{ open: "11:00", close: "23:00" }] };
  }
  if (!str || !str.trim()) return result;

  // Split input into per-day entries. We have to handle two joiners:
  //   • Newlines (Perplexity's natural format: one day per line).
  //   • Commas — but only commas that sit between groups, not commas
  //     separating multiple time blocks on the same day. The lookahead
  //     `, <DayLabel>` tells them apart so we don't shred
  //     "Mon 11:30AM–3PM, 5PM–10:30PM" into two fragments.
  const groupSplit = new RegExp(`,\\s*(?=${DAY_LABEL_PAT}\\b)`, "i");
  const entries = str
    .split(/\r?\n/)
    .flatMap((line) => line.split(groupSplit))
    .map((s) => s.trim())
    .filter(Boolean);

  const dayHead = new RegExp(`^(${DAY_LABEL_RANGE_PAT})\\s*(.*)$`, "i");
  const blockRe =
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/gi;

  let anyMatched = false;
  for (const entry of entries) {
    const headMatch = entry.match(dayHead);
    if (!headMatch) continue;
    const daySeg = headMatch[1].trim();
    const rest = headMatch[2].trim();

    let days: typeof DAYS[number][] = [];
    if (/^daily$/i.test(daySeg)) {
      days = [...DAYS];
    } else {
      const rangeMatch = daySeg.match(
        new RegExp(`^(${DAY_LABEL_PAT})\\s*[-–]\\s*(${DAY_LABEL_PAT})$`, "i"),
      );
      if (rangeMatch) {
        const from = DAY_KEY[rangeMatch[1].toLowerCase()];
        const to = DAY_KEY[rangeMatch[2].toLowerCase()];
        if (from && to) days = expandDayRange(from, to);
      } else {
        const d = DAY_KEY[daySeg.toLowerCase()];
        if (d) days = [d];
      }
    }
    if (days.length === 0) continue;

    if (/^closed$/i.test(rest) || /\bclosed\b/i.test(rest) && !/\d/.test(rest)) {
      for (const d of days) result[d] = { closed: true, blocks: [] };
      anyMatched = true;
      continue;
    }

    blockRe.lastIndex = 0;
    const blocks: TimeBlock[] = [];
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(rest)) !== null) {
      blocks.push({ open: to24(m[1]), close: to24(m[2]) });
    }
    if (blocks.length === 0) continue;
    for (const d of days) result[d] = { closed: false, blocks };
    anyMatched = true;
  }

  // Back-compat fallback: if nothing matched a structured entry but the
  // string still looks like a time range ("11AM–10PM" alone), apply it to
  // every day. Preserves old behavior for legacy scraped_data.
  if (!anyMatched) {
    const timeMatch = str.match(
      /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    );
    if (timeMatch) {
      const block = { open: to24(timeMatch[1]), close: to24(timeMatch[2]) };
      for (const d of DAYS) {
        result[d] = { closed: false, blocks: [block] };
      }
    }
  }

  return result;
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
