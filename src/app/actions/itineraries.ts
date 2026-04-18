"use server";

// Server actions for itineraries. Mirrors the shape of `saves.ts`
// (auth guard → return `{ success }` or typed error). RLS on both
// `user_itineraries` and `user_itinerary_items` enforces ownership;
// these actions layer an early auth check so we don't round-trip
// to Postgres for anonymous callers.
//
// v2: the parent row also carries planning criteria (date, activities,
// vibes, neighborhoods). They're optional inputs / nullable outputs so
// v1 rows keep loading and v1 callers that don't pass them still work.

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITIES_BY_ID,
  ITINERARY_MAX_STOPS,
  VIBE_MOODS,
} from "@/lib/types";
import type { Itinerary, ItineraryItem } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Canonicalizes stored vibes back to the current `VIBE_MOODS` spelling
// when persisting. A stale label in localStorage (e.g. one we renamed)
// gets silently dropped rather than written to the DB.
const VIBE_MOODS_LC: Map<string, string> = new Map(
  VIBE_MOODS.map((v) => [v.toLowerCase(), v]),
);

function cleanActivities(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || seen.has(id) || !ACTIVITIES_BY_ID[id]) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cleanVibes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const canonical = VIBE_MOODS_LC.get(x.trim().toLowerCase());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

function cleanNeighborhoods(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const name = x.trim().slice(0, 60);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export type SaveItineraryInput = {
  /** Present → update that row. Absent → insert a new one. */
  id?: string;
  city: string;
  name: string;
  items: Array<{ spotId: string; timeLabel: string | null }>;
  /** v2 — ISO yyyy-mm-dd or null. */
  date?: string | null;
  /** v2 — `Activity.id` values. Unknown entries dropped. */
  activities?: string[];
  /** v2 — vibe labels from `VIBE_MOODS`. Case-insensitive; canonicalized. */
  vibes?: string[];
  /** v2 — free-form neighborhood names. */
  neighborhoods?: string[];
};

export type SaveItineraryResult =
  | { success: true; id: string }
  | { success: false; error: "unauthenticated" | "too_many_stops" | "empty" | "not_found" | "db_error" };

/**
 * Upsert an itinerary and replace its items atomically (best-effort —
 * Supabase-js doesn't expose transactions, so we do delete-then-insert
 * in a single request batch after the parent row exists).
 */
export async function saveItinerary(
  input: SaveItineraryInput,
): Promise<SaveItineraryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "unauthenticated" };

  if (input.items.length === 0) return { success: false, error: "empty" };
  if (input.items.length > ITINERARY_MAX_STOPS) {
    return { success: false, error: "too_many_stops" };
  }

  const name = input.name.trim() || "Untitled plan";
  const planDate =
    input.date && DATE_RE.test(input.date) ? input.date : null;
  const activities = cleanActivities(input.activities);
  const vibes = cleanVibes(input.vibes);
  const neighborhoods = cleanNeighborhoods(input.neighborhoods);

  // 1. Parent row — insert or update + assert ownership.
  let itineraryId = input.id;
  if (itineraryId) {
    const { data, error } = await supabase
      .from("user_itineraries")
      .update({
        city: input.city,
        name,
        plan_date: planDate,
        activities,
        vibes,
        neighborhoods,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itineraryId)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !data) return { success: false, error: "not_found" };
  } else {
    const { data, error } = await supabase
      .from("user_itineraries")
      .insert({
        user_id: user.id,
        city: input.city,
        name,
        plan_date: planDate,
        activities,
        vibes,
        neighborhoods,
      })
      .select("id")
      .single();
    if (error || !data) return { success: false, error: "db_error" };
    itineraryId = data.id as string;
  }

  // 2. Replace items. Delete-then-insert is acceptable here: an RLS
  //    failure on insert would leave the parent row with zero items,
  //    which the reader renders as an empty state — not destructive.
  const { error: delError } = await supabase
    .from("user_itinerary_items")
    .delete()
    .eq("itinerary_id", itineraryId);
  if (delError) return { success: false, error: "db_error" };

  const rows = input.items.map((it, i) => ({
    itinerary_id: itineraryId!,
    spot_id: it.spotId,
    position: i,
    time_label: it.timeLabel,
  }));
  const { error: insError } = await supabase
    .from("user_itinerary_items")
    .insert(rows);
  if (insError) return { success: false, error: "db_error" };

  return { success: true, id: itineraryId };
}

/** Columns we always fetch from `user_itineraries`. Keeping this as a
 *  constant avoids drift between list/single-row shapes. */
const ITINERARY_COLUMNS =
  "id, user_id, city, name, created_at, updated_at, plan_date, activities, vibes, neighborhoods";

/** Coerces a nullable text[] column into a clean string[]. Postgres
 *  returns `null` when the column is null (legacy rows predating the
 *  NOT NULL default) and an array otherwise. */
function normalizeTextArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export async function getMyItineraries(
  city?: string,
): Promise<Itinerary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("user_itineraries")
    .select(ITINERARY_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (city) query = query.eq("city", city);

  const { data: parents } = await query;
  if (!parents?.length) return [];

  const { data: items } = await supabase
    .from("user_itinerary_items")
    .select("itinerary_id, spot_id, position, time_label")
    .in(
      "itinerary_id",
      parents.map((p) => p.id as string),
    )
    .order("position", { ascending: true });

  const byParent = new Map<string, ItineraryItem[]>();
  for (const row of items ?? []) {
    const id = row.itinerary_id as string;
    const list = byParent.get(id) ?? [];
    list.push({
      spotId: row.spot_id as string,
      position: row.position as number,
      timeLabel: (row.time_label as string | null) ?? null,
    });
    byParent.set(id, list);
  }

  return parents.map((p) => ({
    id: p.id as string,
    userId: p.user_id as string,
    city: p.city as string,
    name: p.name as string,
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
    items: byParent.get(p.id as string) ?? [],
    date: (p.plan_date as string | null) ?? null,
    activities: normalizeTextArray(p.activities),
    vibes: normalizeTextArray(p.vibes),
    neighborhoods: normalizeTextArray(p.neighborhoods),
  }));
}

/** Single-row fetch — used by the saved-itinerary route. */
export async function getItinerary(id: string): Promise<Itinerary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: parent } = await supabase
    .from("user_itineraries")
    .select(ITINERARY_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!parent) return null;

  const { data: items } = await supabase
    .from("user_itinerary_items")
    .select("spot_id, position, time_label")
    .eq("itinerary_id", id)
    .order("position", { ascending: true });

  return {
    id: parent.id as string,
    userId: parent.user_id as string,
    city: parent.city as string,
    name: parent.name as string,
    createdAt: parent.created_at as string,
    updatedAt: parent.updated_at as string,
    items: (items ?? []).map((r) => ({
      spotId: r.spot_id as string,
      position: r.position as number,
      timeLabel: (r.time_label as string | null) ?? null,
    })),
    date: (parent.plan_date as string | null) ?? null,
    activities: normalizeTextArray(parent.activities),
    vibes: normalizeTextArray(parent.vibes),
    neighborhoods: normalizeTextArray(parent.neighborhoods),
  };
}

export async function deleteItinerary(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from("user_itineraries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return { success: !error };
}
