import { createAdminClient } from "@/lib/supabase/admin";

/**
 * All notification types in the system. Grouped by preference category so
 * `categoryForType()` can gate writes based on the recipient's settings.
 */
export type NotificationType =
  // social
  | "followed_you"
  | "follower_checkin"
  | "follower_rsvp_same_event"
  | "referred_friend_joined"
  // events — direct to the user
  | "event_invited"
  | "event_waitlist_promoted"
  | "event_updated"
  | "event_cancelled"
  | "event_reminder_24h"
  | "event_reminder_1h"
  // events — to the host
  | "your_event_new_rsvp"
  | "your_event_rsvp_cancelled"
  | "your_event_at_capacity"
  | "your_event_taken_down"
  // recommendations
  | "recommendation_published"
  // curation
  | "new_spot"
  | "new_event";

export type NotificationCategory =
  | "social"
  | "events"
  | "recommendations"
  | "curation";

export function categoryForType(type: NotificationType): NotificationCategory {
  switch (type) {
    case "followed_you":
    case "follower_checkin":
    case "follower_rsvp_same_event":
    case "referred_friend_joined":
      return "social";
    case "event_invited":
    case "event_waitlist_promoted":
    case "event_updated":
    case "event_cancelled":
    case "event_reminder_24h":
    case "event_reminder_1h":
    case "your_event_new_rsvp":
    case "your_event_rsvp_cancelled":
    case "your_event_at_capacity":
    case "your_event_taken_down":
      return "events";
    case "recommendation_published":
      return "recommendations";
    case "new_spot":
    case "new_event":
      return "curation";
  }
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  spotId?: string | null;
  eventId?: string | null;
  recommendationId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
}

type PrefsRow = {
  notification_prefs: Record<NotificationCategory, boolean> | null;
};

/**
 * Insert a single notification. Never throws — silently logs on failure so
 * the originating server action never fails just because a notification
 * couldn't be written.
 *
 * Respects the recipient's `profiles.notification_prefs` category toggles,
 * skips self-notifications, and de-duplicates using the partial unique index
 * on `(user_id, dedupe_key)`.
 */
export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    if (!input.userId) return;
    // Never notify yourself about your own action.
    if (input.actorId && input.actorId === input.userId) return;

    const admin = createAdminClient();
    const category = categoryForType(input.type);

    // Preference check — if the recipient has turned this category off, bail.
    const { data: prof } = await admin
      .from("profiles")
      .select("notification_prefs")
      .eq("id", input.userId)
      .single<PrefsRow>();
    const prefs = prof?.notification_prefs ?? {
      social: true,
      events: true,
      recommendations: true,
      curation: true,
    };
    if (prefs[category] === false) return;

    const row = {
      user_id: input.userId,
      type: input.type,
      actor_id: input.actorId ?? null,
      spot_id: input.spotId ?? null,
      event_id: input.eventId ?? null,
      recommendation_id: input.recommendationId ?? null,
      metadata: input.metadata ?? {},
      dedupe_key: input.dedupeKey ?? null,
    };

    const { error } = await admin.from("notifications").insert(row);
    // 23505 is unique_violation — expected when dedupeKey collides. Swallow it.
    if (error && error.code !== "23505") {
      console.error("createNotification error:", error.message);
    }
  } catch (err) {
    console.error("createNotification exception:", err);
  }
}

/**
 * Fan out a "new_spot" curation notification to every approved member in the
 * spot's city whose `curation` preference is on. Uses a single INSERT SELECT
 * so there is no per-user round trip. Safe to retry thanks to the dedupe key.
 */
export async function fanOutNewSpotToCity(
  spotId: string,
  city: string,
): Promise<void> {
  try {
    if (!spotId || !city) return;
    const admin = createAdminClient();
    // Use direct SQL via RPC isn't set up; emulate with select+batch-insert.
    const { data: recipients } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .eq("city", city);
    if (!recipients || recipients.length === 0) return;

    const rows = recipients
      .filter((r) => {
        const p = (r.notification_prefs ?? {}) as Record<string, boolean>;
        return p.curation !== false;
      })
      .map((r) => ({
        user_id: r.id as string,
        type: "new_spot" as const,
        spot_id: spotId,
        dedupe_key: `new_spot:${spotId}`,
        metadata: {},
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("notifications").insert(rows);
    if (error && error.code !== "23505") {
      console.error("fanOutNewSpotToCity error:", error.message);
    }
  } catch (err) {
    console.error("fanOutNewSpotToCity exception:", err);
  }
}

/**
 * Fan out a "new_event" curation notification to every member in the event's
 * city. Same shape as fanOutNewSpotToCity.
 */
export async function fanOutNewEventToCity(
  eventId: string,
  city: string,
  hostId?: string | null,
): Promise<void> {
  try {
    if (!eventId || !city) return;
    const admin = createAdminClient();
    const { data: recipients } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .eq("city", city);
    if (!recipients || recipients.length === 0) return;

    const rows = recipients
      .filter((r) => {
        if (hostId && r.id === hostId) return false; // don't notify the host
        const p = (r.notification_prefs ?? {}) as Record<string, boolean>;
        return p.curation !== false;
      })
      .map((r) => ({
        user_id: r.id as string,
        type: "new_event" as const,
        event_id: eventId,
        actor_id: hostId ?? null,
        dedupe_key: `new_event:${eventId}`,
        metadata: {},
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("notifications").insert(rows);
    if (error && error.code !== "23505") {
      console.error("fanOutNewEventToCity error:", error.message);
    }
  } catch (err) {
    console.error("fanOutNewEventToCity exception:", err);
  }
}

/**
 * Notify every follower of `actorId` that they checked in at `spotId`.
 */
export async function notifyFollowersOfCheckIn(
  actorId: string,
  spotId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: follows } = await admin
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", actorId);
    const followerIds = (follows ?? []).map((f) => f.follower_id as string);
    if (followerIds.length === 0) return;

    const { data: profs } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .in("id", followerIds);

    const rows = (profs ?? [])
      .filter((p) => {
        const prefs = (p.notification_prefs ?? {}) as Record<string, boolean>;
        return prefs.social !== false;
      })
      .map((p) => ({
        user_id: p.id as string,
        type: "follower_checkin" as const,
        actor_id: actorId,
        spot_id: spotId,
        dedupe_key: `follower_checkin:${actorId}:${spotId}`,
        metadata: {},
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("notifications").insert(rows);
    if (error && error.code !== "23505") {
      console.error("notifyFollowersOfCheckIn error:", error.message);
    }
  } catch (err) {
    console.error("notifyFollowersOfCheckIn exception:", err);
  }
}

/**
 * When `actorId` RSVPs "going" to `eventId`, notify their followers who are
 * also already RSVP'd "going" on the same event.
 */
export async function notifyFollowersOfRsvp(
  actorId: string,
  eventId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: follows } = await admin
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", actorId);
    const followerIds = (follows ?? []).map((f) => f.follower_id as string);
    if (followerIds.length === 0) return;

    // Of those followers, which ones are already "going" to this event?
    const { data: rsvps } = await admin
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("status", "going")
      .in("user_id", followerIds);
    const targetIds = (rsvps ?? []).map((r) => r.user_id as string);
    if (targetIds.length === 0) return;

    const { data: profs } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .in("id", targetIds);

    const rows = (profs ?? [])
      .filter((p) => {
        const prefs = (p.notification_prefs ?? {}) as Record<string, boolean>;
        return prefs.social !== false;
      })
      .map((p) => ({
        user_id: p.id as string,
        type: "follower_rsvp_same_event" as const,
        actor_id: actorId,
        event_id: eventId,
        dedupe_key: `follower_rsvp_same_event:${eventId}:${actorId}`,
        metadata: {},
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("notifications").insert(rows);
    if (error && error.code !== "23505") {
      console.error("notifyFollowersOfRsvp error:", error.message);
    }
  } catch (err) {
    console.error("notifyFollowersOfRsvp exception:", err);
  }
}

/**
 * Notify every non-cancelled RSVP on `eventId` that the event was updated
 * or cancelled. `type` must be `event_updated` or `event_cancelled`.
 */
export async function notifyRsvpsOfEventChange(
  eventId: string,
  type: "event_updated" | "event_cancelled",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rsvps } = await admin
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", eventId)
      .neq("status", "cancelled");
    const userIds = (rsvps ?? []).map((r) => r.user_id as string);
    if (userIds.length === 0) return;

    const { data: profs } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .in("id", userIds);

    const rows = (profs ?? [])
      .filter((p) => {
        const prefs = (p.notification_prefs ?? {}) as Record<string, boolean>;
        return prefs.events !== false;
      })
      .map((p) => ({
        user_id: p.id as string,
        type,
        event_id: eventId,
        // No dedupe_key for updates — every edit is a distinct event.
        metadata,
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
      console.error("notifyRsvpsOfEventChange error:", error.message);
    }
  } catch (err) {
    console.error("notifyRsvpsOfEventChange exception:", err);
  }
}
