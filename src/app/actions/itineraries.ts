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
//
// v3: plans can be co-viewed. `itinerary_invites` holds the guest list
// and the SELECT policies on user_itineraries / user_itinerary_items
// include invited users. Writes remain owner-only. `isOwner` is tagged
// onto read results so callers can branch UI without a second query.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import {
  ACTIVITIES_BY_ID,
  ITINERARY_MAX_STOPS,
  VIBE_MOODS,
} from "@/lib/types";
import type { Itinerary, ItineraryItem } from "@/lib/types";
import type { MemberSearchResult } from "@/app/actions/events";

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
  /** Optional — the saved-plan UI no longer exposes a name field. The tray
   *  still passes "Untitled plan" for back-compat; empty/omitted is fine. */
  name?: string;
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

  // `name` is legacy — kept in the schema so existing rows don't need a
  // migration, but the new saved-plan UI doesn't collect one. Fall back to
  // "Untitled plan" when blank so list views that still render it don't
  // show a blank row title.
  const name = (input.name ?? "").trim() || "Untitled plan";
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

  // SELECT is RLS-gated to "owner OR invitee" — no explicit user_id filter
  // here, so invited plans show up alongside owned ones in the hub.
  let query = supabase
    .from("user_itineraries")
    .select(ITINERARY_COLUMNS)
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
    isOwner: (p.user_id as string) === user.id,
  }));
}

/** Single-row fetch — used by the saved-itinerary route. */
export async function getItinerary(id: string): Promise<Itinerary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS: owner OR invitee. Drop the explicit user_id eq so invitees can
  // land on the saved-plan page.
  const { data: parent } = await supabase
    .from("user_itineraries")
    .select(ITINERARY_COLUMNS)
    .eq("id", id)
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
    isOwner: (parent.user_id as string) === user.id,
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

// --- Invites ---------------------------------------------------------------
//
// Mirrors the events invite pattern (see `events.ts:392-548`): a small set
// of owner-gated actions around the `itinerary_invites` side table plus a
// `leaveItinerary` for invitees. `MemberSearchResult` is reused so the
// shared `InviteMembersField` component can point at either feature.

async function runItineraryMemberSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  excludeUserId: string,
): Promise<MemberSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, instagram")
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},instagram.ilike.${pattern}`,
    )
    .neq("id", excludeUserId)
    .not("first_name", "is", null)
    .limit(8);

  return (data ?? []) as MemberSearchResult[];
}

/** Owner-only. Returns up to 8 matching members, excluding the caller. */
export async function searchMembersForItineraryInvite(
  itineraryId: string,
  query: string,
): Promise<MemberSearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: plan } = await supabase
    .from("user_itineraries")
    .select("user_id")
    .eq("id", itineraryId)
    .single();
  if (!plan || plan.user_id !== user.id) return [];

  return runItineraryMemberSearch(supabase, query, user.id);
}

/** Owner-only. Returns the current invited members (empty list otherwise). */
export async function getItineraryInvitees(
  itineraryId: string,
): Promise<MemberSearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: plan } = await supabase
    .from("user_itineraries")
    .select("user_id")
    .eq("id", itineraryId)
    .single();
  if (!plan || plan.user_id !== user.id) return [];

  // Two-step fetch instead of a PostgREST embed. The embed pattern
  // `profiles:user_id(...)` works for `event_invites` because PostgREST
  // eventually learns the chain through `auth.users`, but that inference
  // has been flaky on this table post-migration and silently returns
  // `null` rather than an error — which made invited members look like
  // they weren't saved. Explicit join is unambiguous.
  const { data: inviteRows, error: invErr } = await supabase
    .from("itinerary_invites")
    .select("user_id")
    .eq("itinerary_id", itineraryId);
  if (invErr || !inviteRows || inviteRows.length === 0) return [];

  const userIds = inviteRows.map((r) => r.user_id);
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, instagram")
    .in("id", userIds);

  return (profileRows ?? []) as unknown as MemberSearchResult[];
}

/** Owner inserts invite rows. Fires `plan_invited` notifications (deduped). */
export async function inviteItineraryMembers(
  itineraryId: string,
  userIds: string[],
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: plan } = await supabase
    .from("user_itineraries")
    .select("id, user_id, city, plan_date")
    .eq("id", itineraryId)
    .single();
  if (!plan) return { ok: false, error: "Plan not found" };
  if (plan.user_id !== user.id) return { ok: false, error: "Not authorized" };

  const cleanIds = Array.from(new Set(userIds.filter(Boolean))).filter(
    (id) => id !== user.id,
  );
  if (cleanIds.length === 0) return { ok: true, added: 0 };

  const rows = cleanIds.map((id) => ({
    itinerary_id: itineraryId,
    user_id: id,
    invited_by: user.id,
  }));

  const { error } = await supabase
    .from("itinerary_invites")
    .upsert(rows, {
      onConflict: "itinerary_id,user_id",
      ignoreDuplicates: true,
    });
  if (error) return { ok: false, error: error.message };

  await Promise.all(
    cleanIds.map((id) =>
      createNotification({
        userId: id,
        type: "plan_invited",
        actorId: user.id,
        itineraryId,
        metadata: {
          city: plan.city,
          date: (plan.plan_date as string | null) ?? null,
        },
        dedupeKey: `plan_invited:${itineraryId}:${id}`,
      }),
    ),
  );

  revalidatePath(`/plans`);
  return { ok: true, added: cleanIds.length };
}

/** Owner-only. Removes a single invited member from the plan. */
export async function removeItineraryInvite(
  itineraryId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: plan } = await supabase
    .from("user_itineraries")
    .select("user_id")
    .eq("id", itineraryId)
    .single();
  if (!plan) return { ok: false, error: "Plan not found" };
  if (plan.user_id !== user.id) return { ok: false, error: "Not authorized" };

  const { error } = await supabase
    .from("itinerary_invites")
    .delete()
    .eq("itinerary_id", itineraryId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/plans`);
  return { ok: true };
}

/** Invitee removes themselves from a plan. RLS permits self-delete. */
export async function leaveItinerary(
  itineraryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("itinerary_invites")
    .delete()
    .eq("itinerary_id", itineraryId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/plans`);
  return { ok: true };
}
