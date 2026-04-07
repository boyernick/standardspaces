import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventRecord, EventRsvp } from "@/lib/types";

export async function getUpcomingEventsByCity(city: string, limit = 12): Promise<EventRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .ilike("city", city)
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as EventRecord[];
}

export async function getEventsBySpotId(spotId: string): Promise<EventRecord[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("spot_id", spotId)
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (data ?? []) as EventRecord[];
}

export async function getVisibleEventsForSpot(spotId: string): Promise<EventRecord[]> {
  // Uses the admin client (no cookies) so this can run inside statically-prerendered
  // pages. Only public events are returned; surfacing private events the viewer is
  // invited to should be done from a separate dynamic component.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("spot_id", spotId)
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (data ?? []) as EventRecord[];
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  return (data as EventRecord) ?? null;
}

export async function getEventsByHost(userId: string): Promise<EventRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("host_id", userId)
    .neq("status", "hidden")
    .order("starts_at", { ascending: false });
  return (data ?? []) as EventRecord[];
}

export async function getEventsByAttendee(userId: string): Promise<EventRecord[]> {
  const supabase = await createClient();
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id")
    .eq("user_id", userId)
    .eq("status", "going");
  const eventIds = (rsvps ?? []).map((r) => r.event_id);
  if (eventIds.length === 0) return [];

  const { data } = await supabase
    .from("events")
    .select("*")
    .in("id", eventIds)
    .neq("status", "hidden")
    .order("starts_at", { ascending: false });
  return (data ?? []) as EventRecord[];
}

export async function getUpcomingAttendingEvents(userId: string): Promise<EventRecord[]> {
  const all = await getEventsByAttendee(userId);
  const now = Date.now();
  return all.filter((e) => new Date(e.starts_at).getTime() >= now).reverse();
}

export async function getPastAttendedEvents(userId: string): Promise<EventRecord[]> {
  const all = await getEventsByAttendee(userId);
  const now = Date.now();
  return all.filter((e) => new Date(e.starts_at).getTime() < now);
}

export async function getInvitesForUser(userId: string): Promise<EventRecord[]> {
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("event_invites")
    .select("event_id")
    .eq("user_id", userId);
  const eventIds = (invites ?? []).map((i) => i.event_id);
  if (eventIds.length === 0) return [];

  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id")
    .eq("user_id", userId)
    .in("event_id", eventIds);
  const rsvpedIds = new Set((rsvps ?? []).map((r) => r.event_id));
  const pendingIds = eventIds.filter((id) => !rsvpedIds.has(id));
  if (pendingIds.length === 0) return [];

  const { data } = await supabase
    .from("events")
    .select("*")
    .in("id", pendingIds)
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (data ?? []) as EventRecord[];
}

export async function getRsvpsForEvent(eventId: string): Promise<EventRsvp[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  return (data ?? []) as EventRsvp[];
}

export async function countGoingForEvent(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("event_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "going");
  return count ?? 0;
}

export async function getInvitedUserIds(eventId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_invites")
    .select("user_id")
    .eq("event_id", eventId);
  return (data ?? []).map((r) => r.user_id);
}
