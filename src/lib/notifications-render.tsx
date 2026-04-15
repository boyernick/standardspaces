import type { NotificationType } from "@/lib/notifications";

/**
 * Raw notification row shape as returned from the db. Kept loose on purpose —
 * `metadata` is jsonb and the actor/spot/event join fields are hydrated by the
 * notifications page query.
 */
export interface NotificationRow {
  id: string;
  type: NotificationType;
  user_id: string;
  actor_id: string | null;
  spot_id: string | null;
  event_id: string | null;
  recommendation_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  // Hydrated joins (added by the page query)
  actor?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  spot?: {
    id: string;
    name: string;
    city: string;
    neighborhood?: string | null;
  } | null;
  event?: {
    id: string;
    title: string;
    city: string;
    neighborhood?: string | null;
  } | null;
  recommendation?: {
    id: string;
    name: string | null;
  } | null;
}

export interface RenderedNotification {
  icon: "user" | "calendar" | "pin" | "star" | "bell" | "sparkles" | "award" | "compass";
  title: string;
  body: string;
  href: string;
  actorAvatar: string | null;
  actorName: string | null;
}

function actorName(row: NotificationRow): string {
  if (!row.actor) return "Someone";
  const first = row.actor.first_name?.trim() ?? "";
  const last = row.actor.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || "A member";
}

function spotHref(row: NotificationRow): string {
  if (row.spot) {
    const citySlug = row.spot.city.toLowerCase().replace(/\s+/g, "-");
    return `/${citySlug}/${row.spot.id}`;
  }
  return "/";
}

function eventHref(row: NotificationRow): string {
  if (row.event) return `/events/${row.event.id}`;
  return "/events";
}

/**
 * Pure function — turn a db row into render data for `NotificationsClient`.
 * One switch on type. Add new notification types here.
 */
export function renderNotification(row: NotificationRow): RenderedNotification {
  const name = actorName(row);
  const avatar = row.actor?.avatar_url ?? null;
  const actorHref = row.actor ? `/u/${row.actor.id}` : "/";

  switch (row.type) {
    case "followed_you":
      return {
        icon: "user",
        title: `${name} followed you`,
        body: "View their profile",
        href: actorHref,
        actorAvatar: avatar,
        actorName: name,
      };

    case "follower_checkin":
      return {
        icon: "pin",
        title: `${name} checked in at ${row.spot?.name ?? "a space"}`,
        body: "See where they've been",
        href: spotHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "follower_rsvp_same_event":
      return {
        icon: "calendar",
        title: `${name} is going to ${row.event?.title ?? "an event"}`,
        body: "You're attending too",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "referred_friend_joined":
      return {
        icon: "sparkles",
        title: `${name} just became a member`,
        body: "Your referral was approved",
        href: actorHref,
        actorAvatar: avatar,
        actorName: name,
      };

    case "event_invited":
      return {
        icon: "calendar",
        title: `You were invited to ${row.event?.title ?? "an event"}`,
        body: "Tap to view and RSVP",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "event_waitlist_promoted":
      return {
        icon: "calendar",
        title: `You're in! ${row.event?.title ?? "An event"}`,
        body: "A seat opened up on the guest list",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "event_updated":
      return {
        icon: "calendar",
        title: `${row.event?.title ?? "An event"} was updated`,
        body: "Check the latest details",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "event_cancelled":
      return {
        icon: "calendar",
        title: `${row.event?.title ?? "An event"} was cancelled`,
        body: "The host called it off",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "event_reminder_24h":
      return {
        icon: "bell",
        title: `${row.event?.title ?? "Your event"} is tomorrow`,
        body: "Reminder from Standard Spaces",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "event_reminder_1h":
      return {
        icon: "bell",
        title: `${row.event?.title ?? "Your event"} starts in an hour`,
        body: "See you there",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "your_event_new_rsvp":
      return {
        icon: "user",
        title: `${name} is going to your event`,
        body: row.event?.title ?? "",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "your_event_rsvp_cancelled":
      return {
        icon: "user",
        title: `${name} cancelled their RSVP`,
        body: row.event?.title ?? "",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "your_event_at_capacity":
      return {
        icon: "calendar",
        title: `${row.event?.title ?? "Your event"} is fully booked`,
        body: "New RSVPs will join the waitlist",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "your_event_taken_down":
      return {
        icon: "bell",
        title: `Your event was hidden by an admin`,
        body: row.event?.title ?? "",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "recommendation_published":
      return {
        icon: "award",
        title: `Your recommendation is live`,
        body: row.recommendation?.name || row.spot?.name || "Tap to view",
        href: spotHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "new_spot":
      return {
        icon: "compass",
        title: `New space: ${row.spot?.name ?? "Take a look"}`,
        body: row.spot?.neighborhood ?? row.spot?.city ?? "",
        href: spotHref(row),
        actorAvatar: null,
        actorName: null,
      };

    case "new_event":
      return {
        icon: "calendar",
        title: `New event: ${row.event?.title ?? "Take a look"}`,
        body: row.event?.neighborhood ?? row.event?.city ?? "",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
      };

    default:
      return {
        icon: "bell",
        title: "Notification",
        body: "",
        href: "/notifications",
        actorAvatar: null,
        actorName: null,
      };
  }
}
