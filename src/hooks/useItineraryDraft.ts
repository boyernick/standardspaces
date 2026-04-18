"use client";

// Draft-itinerary hook. Backs the city-page tray and the planner's
// unsaved-edits state. Single source of truth: localStorage under
// `ss.itinerary.draft.<city>`. One draft per city — moving to another
// city's tray doesn't affect the current city's draft.
//
// Cross-tab sync: listens for `storage` events so two tabs on the same
// city converge. Same-tab updates fire a custom event because browsers
// don't emit `storage` for the originating tab.
//
// Why localStorage and not IndexedDB: the data is tiny (max 8 items,
// one string + optional HHMM each, plus a few small string arrays for
// criteria), read/written synchronously at UI speed, and already the
// pattern used elsewhere (Navbar, theme).
//
// v2: the draft now carries `date`, `activities`, `vibes`, and
// `neighborhoods` so reloading the planner restores the full authoring
// context. `readDraft` defaults these to null/[] when parsing a
// pre-v2 stored draft, so existing users don't see their in-progress
// work disappear.

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  ACTIVITIES_BY_ID,
  ITINERARY_MAX_STOPS,
  VIBE_MOODS,
  type ItineraryDraft,
  type ItineraryDraftItem,
} from "@/lib/types";
import { emptyDraft } from "@/lib/itinerary-url";

const KEY_PREFIX = "ss.itinerary.draft.";
const CUSTOM_EVENT = "ss:itinerary-draft-change";

// Used by `readDraft` to canonicalize stored vibe labels against the
// current `VIBE_MOODS` constant — if a label no longer exists we drop
// it silently rather than surfacing orphaned chips.
const VIBE_MOODS_LC: Map<string, string> = new Map(
  VIBE_MOODS.map((v) => [v.toLowerCase(), v]),
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function storageKey(city: string): string {
  return `${KEY_PREFIX}${city}`;
}

/** Coerce an unknown value into a string[] of unique, trimmed entries. */
function toStringArray(v: unknown, validate?: (s: string) => string | null): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const trimmed = x.trim();
    if (!trimmed) continue;
    const resolved = validate ? validate(trimmed) : trimmed;
    if (!resolved) continue;
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

function readDraft(city: string): ItineraryDraft {
  if (typeof window === "undefined") return emptyDraft(city);
  try {
    const raw = window.localStorage.getItem(storageKey(city));
    if (!raw) return emptyDraft(city);
    const parsed = JSON.parse(raw) as Partial<ItineraryDraft>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
      return emptyDraft(city);
    }
    // Defensive: strip malformed items rather than throwing.
    const items: ItineraryDraftItem[] = [];
    for (const it of parsed.items) {
      if (it && typeof it === "object" && typeof it.spotId === "string") {
        const timeLabel =
          typeof it.timeLabel === "string" ? it.timeLabel : undefined;
        items.push({ spotId: it.spotId, timeLabel });
      }
    }
    const dateRaw = typeof parsed.date === "string" ? parsed.date : null;
    const date = dateRaw && DATE_RE.test(dateRaw) ? dateRaw : null;
    const activities = toStringArray(parsed.activities, (s) =>
      ACTIVITIES_BY_ID[s] ? s : null,
    );
    const vibes = toStringArray(parsed.vibes, (s) =>
      VIBE_MOODS_LC.get(s.toLowerCase()) ?? null,
    );
    const neighborhoods = toStringArray(parsed.neighborhoods);
    return {
      city,
      name: typeof parsed.name === "string" ? parsed.name : "",
      items: items.slice(0, ITINERARY_MAX_STOPS),
      date,
      activities,
      vibes,
      neighborhoods,
    };
  } catch {
    return emptyDraft(city);
  }
}

/** A draft is "effectively empty" when there's nothing worth persisting.
 *  We use this to garbage-collect the localStorage key so an empty draft
 *  doesn't shadow a brand-new one the user starts elsewhere. */
function isEffectivelyEmpty(draft: ItineraryDraft): boolean {
  return (
    draft.items.length === 0 &&
    !draft.name &&
    !draft.date &&
    draft.activities.length === 0 &&
    draft.vibes.length === 0 &&
    draft.neighborhoods.length === 0
  );
}

function writeDraft(draft: ItineraryDraft): void {
  if (typeof window === "undefined") return;
  try {
    if (isEffectivelyEmpty(draft)) {
      window.localStorage.removeItem(storageKey(draft.city));
    } else {
      window.localStorage.setItem(storageKey(draft.city), JSON.stringify(draft));
    }
    window.dispatchEvent(
      new CustomEvent(CUSTOM_EVENT, { detail: { city: draft.city } }),
    );
  } catch {
    // Quota exceeded / private mode — swallow; the session-level state
    // still reflects the change, we just can't persist it.
  }
}

// --- useSyncExternalStore wiring -----------------------------------------

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(KEY_PREFIX)) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOM_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOM_EVENT, onCustom);
  };
}

export type UseItineraryDraftResult = {
  draft: ItineraryDraft;
  /** True iff `spotId` is in the current draft. */
  has: (spotId: string) => boolean;
  /**
   * Add a spot to the end. No-op if it's already in. Returns `false`
   * and surfaces nothing when capacity is reached — the caller should
   * show a toast. Returns `true` on successful add.
   */
  add: (spotId: string) => boolean;
  /** Remove a spot by id. No-op if not in the draft. */
  remove: (spotId: string) => void;
  /** Replace the ordered list wholesale (drag reorder, time edit, etc.). */
  setItems: (items: ItineraryDraftItem[]) => void;
  /** Rename. Trims + caps to 60 chars via the URL codec's limit. */
  setName: (name: string) => void;
  /** Set the plan's date — ISO yyyy-mm-dd, or null to clear. */
  setDate: (date: string | null) => void;
  /** Replace the selected activity ids wholesale. Unknown ids dropped. */
  setActivities: (activities: string[]) => void;
  /** Replace the selected vibes wholesale. Unknown labels dropped. */
  setVibes: (vibes: string[]) => void;
  /** Replace the selected neighborhoods wholesale. */
  setNeighborhoods: (neighborhoods: string[]) => void;
  /** Reset to an empty draft. */
  clear: () => void;
  /** Is draft full? Exposed so callers can conditionally render "Full" UI. */
  isFull: boolean;
};

/**
 * Read + mutate the per-city draft. Pass the city slug; the hook
 * scopes both the key and the returned draft object. Calling this in
 * a component with a different city creates an independent draft.
 */
export function useItineraryDraft(city: string): UseItineraryDraftResult {
  // Stable snapshot per-render. We cache by (city, JSON-serialized) so
  // React's identity check in useSyncExternalStore doesn't tear.
  const cacheRef = useRef<{ key: string; value: ItineraryDraft } | null>(null);
  const getSnapshot = useCallback((): ItineraryDraft => {
    if (typeof window === "undefined") {
      // SSR: always return a stable empty draft for the city.
      const cached = cacheRef.current;
      if (cached && cached.key === `ssr:${city}`) return cached.value;
      const value = emptyDraft(city);
      cacheRef.current = { key: `ssr:${city}`, value };
      return value;
    }
    const raw = window.localStorage.getItem(storageKey(city)) ?? "";
    const key = `${city}:${raw}`;
    const cached = cacheRef.current;
    if (cached && cached.key === key) return cached.value;
    const value = readDraft(city);
    cacheRef.current = { key, value };
    return value;
  }, [city]);

  const getServerSnapshot = useCallback(
    (): ItineraryDraft => emptyDraft(city),
    [city],
  );

  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Clear the cache when the city changes so the first read re-hydrates.
  useEffect(() => {
    cacheRef.current = null;
  }, [city]);

  const has = useCallback(
    (spotId: string) => draft.items.some((it) => it.spotId === spotId),
    [draft.items],
  );

  const add = useCallback(
    (spotId: string): boolean => {
      const current = readDraft(city);
      if (current.items.some((it) => it.spotId === spotId)) return true;
      if (current.items.length >= ITINERARY_MAX_STOPS) return false;
      writeDraft({
        ...current,
        items: [...current.items, { spotId }],
      });
      return true;
    },
    [city],
  );

  const remove = useCallback(
    (spotId: string) => {
      const current = readDraft(city);
      const items = current.items.filter((it) => it.spotId !== spotId);
      if (items.length === current.items.length) return;
      writeDraft({ ...current, items });
    },
    [city],
  );

  const setItems = useCallback(
    (items: ItineraryDraftItem[]) => {
      const current = readDraft(city);
      writeDraft({
        ...current,
        items: items.slice(0, ITINERARY_MAX_STOPS),
      });
    },
    [city],
  );

  const setName = useCallback(
    (name: string) => {
      const current = readDraft(city);
      writeDraft({ ...current, name: name.slice(0, 60) });
    },
    [city],
  );

  const setDate = useCallback(
    (date: string | null) => {
      const current = readDraft(city);
      const next = date && DATE_RE.test(date) ? date : null;
      writeDraft({ ...current, date: next });
    },
    [city],
  );

  const setActivities = useCallback(
    (activities: string[]) => {
      const current = readDraft(city);
      const cleaned = toStringArray(activities, (s) =>
        ACTIVITIES_BY_ID[s] ? s : null,
      );
      writeDraft({ ...current, activities: cleaned });
    },
    [city],
  );

  const setVibes = useCallback(
    (vibes: string[]) => {
      const current = readDraft(city);
      const cleaned = toStringArray(vibes, (s) =>
        VIBE_MOODS_LC.get(s.toLowerCase()) ?? null,
      );
      writeDraft({ ...current, vibes: cleaned });
    },
    [city],
  );

  const setNeighborhoods = useCallback(
    (neighborhoods: string[]) => {
      const current = readDraft(city);
      const cleaned = toStringArray(neighborhoods);
      writeDraft({ ...current, neighborhoods: cleaned });
    },
    [city],
  );

  const clear = useCallback(() => {
    writeDraft(emptyDraft(city));
  }, [city]);

  return {
    draft,
    has,
    add,
    remove,
    setItems,
    setName,
    setDate,
    setActivities,
    setVibes,
    setNeighborhoods,
    clear,
    isFull: draft.items.length >= ITINERARY_MAX_STOPS,
  };
}

/**
 * Imperative writer — used by the share view's "Duplicate to edit"
 * action to rehydrate a share-URL into the local draft before
 * redirecting into the planner. Callers can pass a partial draft; any
 * omitted fields default to their empty-draft values.
 */
export function writeDraftImperative(
  draft: Omit<Partial<ItineraryDraft>, "city"> & { city: string },
): void {
  const base = emptyDraft(draft.city);
  writeDraft({ ...base, ...draft });
}
