"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { getSpotById, searchSpots } from "@/lib/data";
import { EventRecord, Spot } from "@/lib/types";
import {
  createNotification,
  fanOutNewEventToCity,
  notifyFollowersOfRsvp,
  notifyRsvpsOfEventChange,
} from "@/lib/notifications";

export async function searchSpotsForPicker(query: string): Promise<Spot[]> {
  await requireAuth();
  return searchSpots(query, 8);
}

export interface EventInput {
  spot_id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  images?: string[];
  starts_at: string;
  ends_at: string;
  capacity?: number | null;
  price_cents?: number;
  visibility?: "public" | "private";
  age_restriction?: string | null;
}

export async function createEvent(
  input: EventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireAuth();

  if (!input.title.trim()) return { ok: false, error: "Title is required" };
  if (!input.spot_id) return { ok: false, error: "Spot is required" };
  if (new Date(input.ends_at) <= new Date(input.starts_at))
    return { ok: false, error: "End time must be after start time" };

  const spot = await getSpotById(input.spot_id);
  if (!spot) return { ok: false, error: "Spot not found" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      spot_id: input.spot_id,
      host_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      cover_image_url: input.cover_image_url || (input.images && input.images[0]) || null,
      images: input.images ?? [],
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      city: spot.city,
      capacity: input.capacity ?? null,
      price_cents: input.price_cents ?? 0,
      visibility: input.visibility ?? "public",
      age_restriction: input.age_restriction?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Failed to create event" };

  // Curation fan-out: only for public, published events.
  if ((input.visibility ?? "public") === "public") {
    await fanOutNewEventToCity(data.id, spot.city, user.id);
  }

  revalidatePath(`/${spot.city}`);
  revalidatePath(`/${spot.city}/${spot.id}`);
  return { ok: true, id: data.id };
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (!existing) return { ok: false, error: "Event not found" };
  if (existing.host_id !== user.id) return { ok: false, error: "Not authorized" };

  // Disallow flipping public→private after RSVPs exist
  if (
    existing.visibility === "public" &&
    input.visibility === "private"
  ) {
    const { count } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .neq("status", "cancelled");
    if ((count ?? 0) > 0)
      return { ok: false, error: "Cannot make event private after RSVPs exist" };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url;
  if (input.images !== undefined) {
    patch.images = input.images;
    // Keep cover_image_url in sync with the first image so legacy surfaces still work
    if (input.images.length > 0 && input.cover_image_url === undefined) {
      patch.cover_image_url = input.images[0];
    }
  }
  if (input.starts_at !== undefined) patch.starts_at = input.starts_at;
  if (input.ends_at !== undefined) patch.ends_at = input.ends_at;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.price_cents !== undefined) patch.price_cents = input.price_cents;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.age_restriction !== undefined) patch.age_restriction = input.age_restriction?.trim() || null;

  if (input.spot_id !== undefined && input.spot_id !== existing.spot_id) {
    const spot = await getSpotById(input.spot_id);
    if (!spot) return { ok: false, error: "Spot not found" };
    patch.spot_id = input.spot_id;
    patch.city = spot.city;
  }

  const { error } = await supabase.from("events").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Only notify RSVPs when a material field changed. Title/description edits
  // are often cosmetic, but start/end time and spot are the ones attendees
  // care about — keep it simple for v1 and notify on any such change.
  const materialChanged =
    patch.starts_at !== undefined ||
    patch.ends_at !== undefined ||
    patch.spot_id !== undefined ||
    patch.title !== undefined;
  if (materialChanged) {
    await notifyRsvpsOfEventChange(id, "event_updated", {
      title: existing.title,
    });
  }

  revalidatePath(`/events/${id}`);
  revalidatePath(`/${existing.city}`);
  return { ok: true };
}

export async function cancelEvent(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("events")
    .select("host_id, city")
    .eq("id", id)
    .single();
  if (!existing) return { ok: false, error: "Event not found" };
  if (existing.host_id !== user.id) return { ok: false, error: "Not authorized" };

  const { error } = await supabase
    .from("events")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await notifyRsvpsOfEventChange(id, "event_cancelled");

  revalidatePath(`/events/${id}`);
  revalidatePath(`/${existing.city}`);
  return { ok: true };
}

export async function rsvpEvent(
  eventId: string
): Promise<
  | { ok: true; status: "going" | "waitlist" }
  | { ok: false; error: string }
> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, error: "Event not found" };
  const ev = event as EventRecord;
  if (ev.status !== "published") return { ok: false, error: "Event is not open for RSVPs" };
  if (ev.price_cents > 0)
    return { ok: false, error: "This is a paid event — use checkout instead" };

  if (ev.visibility === "private") {
    const { data: invite } = await supabase
      .from("event_invites")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();
    if (!invite) return { ok: false, error: "You are not invited to this event" };
  }

  // Determine seat: going if under capacity, else waitlist
  let nextStatus: "going" | "waitlist" = "going";
  if (ev.capacity != null) {
    const { count } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "going");
    if ((count ?? 0) >= ev.capacity) nextStatus = "waitlist";
  }

  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      {
        event_id: eventId,
        user_id: user.id,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" }
    );
  if (error) return { ok: false, error: error.message };

  // Notifications. Only fire for "going" RSVPs; waitlisting is silent.
  if (nextStatus === "going") {
    // Host: new RSVP.
    await createNotification({
      userId: ev.host_id,
      type: "your_event_new_rsvp",
      actorId: user.id,
      eventId,
      dedupeKey: `your_event_new_rsvp:${eventId}:${user.id}`,
    });

    // Host: event just hit capacity.
    if (ev.capacity != null) {
      const admin = createAdminClient();
      const { count: goingCount } = await admin
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going");
      if ((goingCount ?? 0) >= ev.capacity) {
        await createNotification({
          userId: ev.host_id,
          type: "your_event_at_capacity",
          eventId,
          dedupeKey: `your_event_at_capacity:${eventId}`,
        });
      }
    }

    // Followers already attending: social heads-up.
    await notifyFollowersOfRsvp(user.id, eventId);
  }

  revalidatePath(`/events/${eventId}`);
  return { ok: true, status: nextStatus };
}

export async function cancelRsvp(
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("event_rsvps")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { ok: false, error: "No RSVP found" };

  const wasGoing = existing.status === "going";

  const { error } = await supabase
    .from("event_rsvps")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  // Notify the host of the cancellation.
  const { data: hostRow } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();
  if (hostRow?.host_id) {
    await createNotification({
      userId: hostRow.host_id,
      type: "your_event_rsvp_cancelled",
      actorId: user.id,
      eventId,
    });
  }

  // Promote oldest waitlist row if a 'going' seat opened up
  if (wasGoing) {
    const { data: nextUp } = await supabase
      .from("event_rsvps")
      .select("id, user_id")
      .eq("event_id", eventId)
      .eq("status", "waitlist")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (nextUp) {
      // Use admin client: RLS only permits users to update their own RSVPs
      const admin = createAdminClient();
      await admin
        .from("event_rsvps")
        .update({ status: "going", updated_at: new Date().toISOString() })
        .eq("id", nextUp.id);
      // Notify the promoted attendee.
      await createNotification({
        userId: nextUp.user_id as string,
        type: "event_waitlist_promoted",
        eventId,
        dedupeKey: `waitlist_promoted:${eventId}:${nextUp.user_id}`,
      });
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function adminTakedown(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("events")
    .select("host_id, title")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("events")
    .update({ status: "hidden", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (ev?.host_id) {
    await createNotification({
      userId: ev.host_id,
      type: "your_event_taken_down",
      eventId: id,
      metadata: { title: ev.title ?? null },
    });
  }

  revalidatePath("/admin/events");
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

export interface MemberSearchResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
}

export async function searchMembersForInvite(
  eventId: string,
  query: string
): Promise<MemberSearchResult[]> {
  const user = await requireAuth();
  const supabase = await createClient();

  // Verify caller is the host
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();
  if (!event || event.host_id !== user.id) return [];

  return runMemberSearch(supabase, query, user.id);
}

// Event-agnostic variant used by the create/edit form — before the event
// exists we have no host_id to verify against, but any authenticated member
// can already browse the directory so this is no new exposure.
export async function searchMembers(query: string): Promise<MemberSearchResult[]> {
  const user = await requireAuth();
  const supabase = await createClient();
  return runMemberSearch(supabase, query, user.id);
}

async function runMemberSearch(
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
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},instagram.ilike.${pattern}`)
    .neq("id", excludeUserId)
    .not("first_name", "is", null)
    .limit(8);

  return (data ?? []) as MemberSearchResult[];
}

export async function getInvitedMembers(eventId: string): Promise<MemberSearchResult[]> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();
  if (!event || event.host_id !== user.id) return [];

  const { data } = await supabase
    .from("event_invites")
    .select("user_id, profiles:user_id(id, first_name, last_name, avatar_url, instagram)")
    .eq("event_id", eventId);

  return ((data ?? [])
    .map((r) => r.profiles)
    .filter(Boolean) as unknown) as MemberSearchResult[];
}

export async function inviteMembers(
  eventId: string,
  userIds: string[]
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, host_id, visibility, title")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, error: "Event not found" };
  if (event.host_id !== user.id) return { ok: false, error: "Not authorized" };
  if (event.visibility !== "private")
    return { ok: false, error: "Only private events can have invites" };

  const cleanIds = Array.from(new Set(userIds.filter(Boolean))).filter((id) => id !== user.id);
  if (cleanIds.length === 0) return { ok: true, added: 0 };

  const rows = cleanIds.map((id) => ({
    event_id: eventId,
    user_id: id,
    invited_by: user.id,
  }));

  const { error } = await supabase
    .from("event_invites")
    .upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  // Notify each invited user. Dedupe so re-inviting is a no-op.
  await Promise.all(
    cleanIds.map((id) =>
      createNotification({
        userId: id,
        type: "event_invited",
        actorId: user.id,
        eventId,
        metadata: { title: event.title },
        dedupeKey: `event_invited:${eventId}:${id}`,
      }),
    ),
  );

  revalidatePath(`/events/${eventId}`);
  return { ok: true, added: cleanIds.length };
}

export async function removeInvite(
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, error: "Event not found" };
  if (event.host_id !== user.id) return { ok: false, error: "Not authorized" };

  const { error: delInviteErr } = await supabase
    .from("event_invites")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (delInviteErr) return { ok: false, error: delInviteErr.message };

  // Also remove any RSVP this user had
  await supabase
    .from("event_rsvps")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function adminRestore(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/events");
  revalidatePath(`/events/${id}`);
  return { ok: true };
}
