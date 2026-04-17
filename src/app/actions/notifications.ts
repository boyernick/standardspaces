"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationRow } from "@/lib/notifications-render";

/**
 * Fetch the latest notifications for the current user, hydrated with the
 * actor profile, spot, event and recommendation data needed by the
 * `renderNotification()` helper.
 */
export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch the flat rows via RLS-scoped anon client first.
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !rows) return [];

  // Hydrate actors, spots, events, recommendations in parallel using the
  // admin client (spot/event data lives in tables the user may not have
  // direct read access to in all cases, and we want a single fast batch).
  const admin = createAdminClient();
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id)),
  );
  const spotIds = Array.from(
    new Set(rows.map((r) => r.spot_id).filter((id): id is string => !!id)),
  );
  const eventIds = Array.from(
    new Set(rows.map((r) => r.event_id).filter((id): id is string => !!id)),
  );
  const recIds = Array.from(
    new Set(
      rows.map((r) => r.recommendation_id).filter((id): id is string => !!id),
    ),
  );

  const [actorsRes, spotsRes, eventsRes, recsRes] = await Promise.all([
    actorIds.length
      ? admin
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }> }),
    spotIds.length
      ? admin
          .from("spots")
          .select("id, name, city, neighborhood, images, category, subcategory")
          .in("id", spotIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            city: string;
            neighborhood: string | null;
            images: string[] | null;
            category: string[] | null;
            subcategory: string[] | null;
          }>,
        }),
    eventIds.length
      ? admin
          .from("events")
          .select("id, title, city, cover_image_url, images")
          .in("id", eventIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            title: string;
            city: string;
            cover_image_url: string | null;
            images: string[] | null;
          }>,
        }),
    recIds.length
      ? admin.from("recommendations").select("id, name").in("id", recIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const actors = new Map((actorsRes.data ?? []).map((a) => [a.id, a]));
  const spots = new Map(
    (spotsRes.data ?? []).map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        city: s.city,
        neighborhood: s.neighborhood,
        // NotificationItem renders `image` as a rounded tile. The spots row
        // stores an ordered array — first entry is the hero, so that's what
        // we surface.
        image: s.images?.[0] ?? null,
        category: s.category ?? null,
        subcategory: s.subcategory ?? null,
      },
    ]),
  );
  const events = new Map(
    (eventsRes.data ?? []).map((e) => [
      e.id,
      {
        id: e.id,
        title: e.title,
        city: e.city,
        // Prefer the explicit cover; fall back to first entry in images[] so
        // older rows without a cover still get a visual.
        image: e.cover_image_url ?? e.images?.[0] ?? null,
      },
    ]),
  );
  const recs = new Map((recsRes.data ?? []).map((r) => [r.id, r]));

  return rows.map((r) => ({
    ...r,
    actor: r.actor_id ? actors.get(r.actor_id) ?? null : null,
    spot: r.spot_id ? spots.get(r.spot_id) ?? null : null,
    event: r.event_id ? events.get(r.event_id) ?? null : null,
    recommendation: r.recommendation_id
      ? recs.get(r.recommendation_id) ?? null
      : null,
  })) as NotificationRow[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  return { ok: !error };
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  return { ok: !error };
}
