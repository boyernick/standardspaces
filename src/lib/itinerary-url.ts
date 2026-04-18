// Shareable itinerary URL codec.
//
// Format (v2):
//   /[city]/itinerary/share
//     ?s=<spotId>[:HHMM](,<spotId>[:HHMM])*
//     &n=<name>
//     &d=<YYYY-MM-DD>
//     &act=<activityId>(,<activityId>)*
//     &v=<vibe>(,<vibe>)*
//     &a=<neighborhood>(,<neighborhood>)*
//
// Example:
//   /miami/itinerary/share?s=gekko-miami:1900,delilah,komodo-miami:2130
//                         &n=Saturday%20night&d=2026-05-02
//                         &act=dinner,drinks&v=Rooftop,Intimate&a=Wynwood
//
// Design notes:
// - `spotId` is a text slug (e.g. "gekko-miami") so commas and colons are
//   never part of it — safe separators.
// - Times are "HHMM" (24h, zero-padded) for compact, stable encoding.
// - `n` is optional; when present it's rendered via `new URLSearchParams`
//   so it's RFC-3986 percent-encoded. Same for `v` and `a` which may
//   contain spaces ("Late night", "Mid Beach").
// - The parser is deliberately forgiving: bogus spot IDs, malformed
//   times, unknown activity IDs, or unknown vibes are dropped
//   individually — we never throw. Invariant: a tampered URL still
//   renders a valid (possibly shorter) plan.
// - `act` values are validated against `ACTIVITIES_BY_ID` so a stale or
//   hostile URL can't inject arbitrary strings into the UI's activity
//   chips. `v` values are validated against `VIBE_MOODS` for the same
//   reason. `a` (neighborhoods) are free-form — the city's neighborhood
//   list is data-driven and we'd rather show an obsolete area name than
//   silently drop it.

import type { ItineraryDraftItem, ItineraryDraft } from "./types";
import { ACTIVITIES_BY_ID, VIBE_MOODS } from "./types";

const TIME_RE = /^([01]\d|2[0-3])[0-5]\d$/; // "0000"–"2359"
const SPOT_ID_RE = /^[a-z0-9][a-z0-9-]*$/i; // slug-ish — matches our spots.id scheme
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // ISO yyyy-mm-dd
const MAX_NAME_LEN = 60;
const MAX_NEIGHBORHOOD_LEN = 60;

// Lowercase set for O(1) vibe validation. `VIBE_MOODS` is already the
// canonical casing, so we compare case-insensitively on parse and
// normalize back to the canonical spelling.
const VIBE_MOODS_LC: Map<string, string> = new Map(
  VIBE_MOODS.map((v) => [v.toLowerCase(), v]),
);

/** Serialize a draft (without the city — the city is in the URL path). */
export function serializeItineraryUrl(input: {
  items: ItineraryDraftItem[];
  name?: string;
  date?: string | null;
  activities?: string[];
  vibes?: string[];
  neighborhoods?: string[];
}): string {
  const parts = input.items
    .filter((it) => SPOT_ID_RE.test(it.spotId))
    .map((it) =>
      it.timeLabel && TIME_RE.test(it.timeLabel)
        ? `${it.spotId}:${it.timeLabel}`
        : it.spotId,
    );
  const params = new URLSearchParams();
  if (parts.length) params.set("s", parts.join(","));
  if (input.name && input.name.trim()) {
    params.set("n", input.name.trim().slice(0, MAX_NAME_LEN));
  }
  if (input.date && DATE_RE.test(input.date)) {
    params.set("d", input.date);
  }
  if (input.activities && input.activities.length) {
    const valid = input.activities.filter((id) => ACTIVITIES_BY_ID[id]);
    if (valid.length) params.set("act", valid.join(","));
  }
  if (input.vibes && input.vibes.length) {
    const valid = input.vibes.filter((v) => VIBE_MOODS_LC.has(v.toLowerCase()));
    if (valid.length) params.set("v", valid.join(","));
  }
  if (input.neighborhoods && input.neighborhoods.length) {
    const valid = input.neighborhoods
      .map((n) => n.trim().slice(0, MAX_NEIGHBORHOOD_LEN))
      .filter((n) => n.length > 0);
    if (valid.length) params.set("a", valid.join(","));
  }
  return params.toString();
}

/**
 * Parse the query values. Accepts raw query strings as well as
 * already-decoded arrays (e.g. from `URLSearchParams.get`).
 *
 * Returns empty arrays / null (never null collections) so callers can
 * render the empty-state cleanly without a second branch.
 */
export function parseItineraryUrl(search: {
  s?: string | null;
  n?: string | null;
  d?: string | null;
  act?: string | null;
  v?: string | null;
  a?: string | null;
}): {
  items: ItineraryDraftItem[];
  name: string;
  date: string | null;
  activities: string[];
  vibes: string[];
  neighborhoods: string[];
} {
  const s = (search.s ?? "").trim();
  const name = (search.n ?? "").trim().slice(0, MAX_NAME_LEN);

  const items: ItineraryDraftItem[] = [];
  if (s) {
    for (const raw of s.split(",")) {
      const token = raw.trim();
      if (!token) continue;
      const [spotId, maybeTime] = token.split(":");
      if (!spotId || !SPOT_ID_RE.test(spotId)) continue;
      const timeLabel =
        maybeTime && TIME_RE.test(maybeTime) ? maybeTime : undefined;
      items.push({ spotId, timeLabel });
    }
  }

  const dateRaw = (search.d ?? "").trim();
  const date = DATE_RE.test(dateRaw) ? dateRaw : null;

  const activities: string[] = [];
  const actRaw = (search.act ?? "").trim();
  if (actRaw) {
    const seen = new Set<string>();
    for (const token of actRaw.split(",")) {
      const id = token.trim();
      if (!id || seen.has(id)) continue;
      if (!ACTIVITIES_BY_ID[id]) continue; // drop unknown
      seen.add(id);
      activities.push(id);
    }
  }

  const vibes: string[] = [];
  const vRaw = (search.v ?? "").trim();
  if (vRaw) {
    const seen = new Set<string>();
    for (const token of vRaw.split(",")) {
      const label = token.trim();
      if (!label) continue;
      const canonical = VIBE_MOODS_LC.get(label.toLowerCase());
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      vibes.push(canonical);
    }
  }

  const neighborhoods: string[] = [];
  const aRaw = (search.a ?? "").trim();
  if (aRaw) {
    const seen = new Set<string>();
    for (const token of aRaw.split(",")) {
      const name = token.trim().slice(0, MAX_NEIGHBORHOOD_LEN);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      neighborhoods.push(name);
    }
  }

  return { items, name, date, activities, vibes, neighborhoods };
}

/**
 * Format a stored "HHMM" as a human label — "7:00 PM", "12:30 AM".
 * Returns `null` for invalid input so the UI can cleanly fall through.
 */
export function formatTime(hhmm: string | null | undefined): string | null {
  if (!hhmm || !TIME_RE.test(hhmm)) return null;
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(2, 4));
  const mm = m.toString().padStart(2, "0");
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${period}`;
}

/**
 * Convert a native `<input type="time">` value ("HH:MM") to the stored
 * "HHMM" format. Returns null for blanks/malformed input so the caller
 * can clear the field rather than storing garbage.
 */
export function parseTimeInputValue(value: string): string | null {
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hhmm = `${m[1]}${m[2]}`;
  return TIME_RE.test(hhmm) ? hhmm : null;
}

/**
 * Convert a stored "HHMM" to a value suitable for `<input type="time">`
 * ("HH:MM"). Returns "" when blank so React treats the input as
 * uncontrolled-empty.
 */
export function toTimeInputValue(hhmm: string | null | undefined): string {
  if (!hhmm || !TIME_RE.test(hhmm)) return "";
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

/** Build the share URL for a given city + draft. Exported for tests. */
export function buildShareUrl(
  origin: string,
  citySlug: string,
  input: {
    items: ItineraryDraftItem[];
    name?: string;
    date?: string | null;
    activities?: string[];
    vibes?: string[];
    neighborhoods?: string[];
  },
): string {
  const qs = serializeItineraryUrl(input);
  const base = `${origin}/${citySlug}/itinerary/share`;
  return qs ? `${base}?${qs}` : base;
}

/** Helper for the hook: produce a fresh empty draft for a city. */
export function emptyDraft(city: string): ItineraryDraft {
  return {
    city,
    name: "",
    items: [],
    date: null,
    activities: [],
    vibes: [],
    neighborhoods: [],
  };
}
