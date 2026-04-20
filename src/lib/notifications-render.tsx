import type { ReactNode } from "react";
import type { NotificationType } from "@/lib/notifications";
import { citySlugFromName } from "@/lib/cities";

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
  itinerary_id: string | null;
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
    image?: string | null;
    category?: string[] | null;
    subcategory?: string[] | null;
  } | null;
  event?: {
    id: string;
    title: string;
    city: string;
    neighborhood?: string | null;
    image?: string | null;
  } | null;
  itinerary?: {
    id: string;
    city: string;
    date: string | null;
  } | null;
  recommendation?: {
    id: string;
    name: string | null;
  } | null;
}

export interface RenderedNotification {
  icon: "user" | "calendar" | "pin" | "star" | "bell" | "sparkles" | "award" | "compass";
  /**
   * Accepts a plain string for simple cases and a ReactNode for the few
   * notifications that need inline weight emphasis on the subject (e.g.
   * `new_spot` bolds the space name so it reads as the headline of the row,
   * not lost in the sentence).
   */
  title: ReactNode;
  body: string;
  href: string;
  actorAvatar: string | null;
  actorName: string | null;
  /**
   * Rendered as a rounded-square tile to the left of the title. Used when
   * the notification is "about" a specific space or event — we lead with
   * its hero/cover image instead of a generic icon. Falls through to
   * `actorAvatar` / icon tile when null. Only set when there's no actor
   * avatar to show (actor beats cover — person-to-person rows read better
   * with the actor's face).
   */
  coverImage?: string | null;
}

/**
 * Format category + subcategory for notification body copy.
 * Stored values are lowercase slugs ("drinks", "speakeasy"); the body reads
 * in title case per app-wide typography rules. Single category shows alone;
 * category + subcategory joins with a middle dot ("Drinks · Speakeasy").
 */
function formatCategoryLine(
  category: string[] | null | undefined,
  subcategory: string[] | null | undefined,
): string {
  const tc = (s: string) =>
    s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cat = category?.[0]?.trim();
  const sub = subcategory?.[0]?.trim();
  if (cat && sub) return `${tc(cat)} · ${tc(sub)}`;
  if (cat) return tc(cat);
  if (sub) return tc(sub);
  return "";
}

/**
 * Inline emphasis wrapper. Every notification row title puts its "subject"
 * (the person, space, or event the row is about) in `font-semibold` so the
 * name reads as the headline of the row and the rest of the sentence stays
 * secondary. Unread rows get `font-medium` on the whole paragraph upstream;
 * semibold still reads a step heavier in that state, so the hierarchy
 * survives either way.
 */
function bold(text: string): ReactNode {
  return <span className="font-semibold">{text}</span>;
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

function itineraryHref(row: NotificationRow): string {
  if (row.itinerary) {
    const slug = citySlugFromName(row.itinerary.city);
    return `/${slug}/itinerary/${row.itinerary.id}`;
  }
  return "/plans";
}

// "Fri, Apr 25". Plan dates are stored as ISO yyyy-mm-dd; append a local-
// midnight time so the browser doesn't roll back a day in behind-UTC zones.
function formatPlanDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Pure function — turn a db row into render data for `NotificationsClient`.
 * One switch on type. Add new notification types here.
 */
export function renderNotification(row: NotificationRow): RenderedNotification {
  const name = actorName(row);
  const avatar = row.actor?.avatar_url ?? null;
  const actorHref = row.actor ? `/members/${row.actor.id}` : "/";

  switch (row.type) {
    case "followed_you":
      return {
        icon: "user",
        title: <>{bold(name)} followed you</>,
        body: "View their profile",
        href: actorHref,
        actorAvatar: avatar,
        actorName: name,
      };

    case "follower_checkin": {
      const score = typeof row.metadata?.score === "number"
        ? (row.metadata.score as number)
        : null;
      const spotTitle = row.spot?.name ?? "a space";
      // Two subjects in one sentence (person + space) — only bold the actor
      // so one "headline" stays dominant. Score moves to body to keep the
      // title a clean single-clause sentence.
      return {
        icon: "pin",
        title: (
          <>
            {bold(name)} checked in at {spotTitle}
          </>
        ),
        body:
          score !== null
            ? `${score.toFixed(1)} · See where they've been`
            : "See where they've been",
        href: spotHref(row),
        actorAvatar: avatar,
        actorName: name,
      };
    }

    case "follower_rsvp_same_event":
      return {
        icon: "calendar",
        title: (
          <>
            {bold(name)} is going to {row.event?.title ?? "an event"}
          </>
        ),
        body: "You're attending too",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "referred_friend_joined":
      return {
        icon: "sparkles",
        title: <>{bold(name)} just became a member</>,
        body: "Your referral was approved",
        href: actorHref,
        actorAvatar: avatar,
        actorName: name,
      };

    case "event_invited":
      // Actor avatar leads (inviter identity reads faster than the event
      // name in a dense list). Bold the inviter in the title for parity.
      return {
        icon: "calendar",
        title: (
          <>
            {bold(name)} invited you to {row.event?.title ?? "an event"}
          </>
        ),
        body: "Tap to view and RSVP",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "event_waitlist_promoted":
      return {
        icon: "calendar",
        title: (
          <>
            You&apos;re in — {bold(row.event?.title ?? "your event")}
          </>
        ),
        body: "A seat opened up on the guest list",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "event_updated":
      return {
        icon: "calendar",
        title: (
          <>
            {bold(row.event?.title ?? "An event")} was updated
          </>
        ),
        body: "Check the latest details",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "event_cancelled":
      return {
        icon: "calendar",
        title: (
          <>
            {bold(row.event?.title ?? "An event")} was cancelled
          </>
        ),
        body: "The host called it off",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "event_reminder_24h":
      return {
        icon: "bell",
        title: (
          <>
            {bold(row.event?.title ?? "Your event")} is tomorrow
          </>
        ),
        body: "Reminder from Standard Spaces",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "event_reminder_1h":
      return {
        icon: "bell",
        title: (
          <>
            {bold(row.event?.title ?? "Your event")} starts in an hour
          </>
        ),
        body: "See you there",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "your_event_new_rsvp":
      return {
        icon: "user",
        title: <>{bold(name)} is going to your event</>,
        body: row.event?.title ?? "",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "your_event_rsvp_cancelled":
      return {
        icon: "user",
        title: <>{bold(name)} cancelled their RSVP</>,
        body: row.event?.title ?? "",
        href: eventHref(row),
        actorAvatar: avatar,
        actorName: name,
      };

    case "your_event_at_capacity":
      return {
        icon: "calendar",
        title: (
          <>
            {bold(row.event?.title ?? "Your event")} is fully booked
          </>
        ),
        body: "New RSVPs will join the waitlist",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "your_event_taken_down":
      return {
        icon: "bell",
        title: (
          <>
            {bold(row.event?.title ?? "Your event")} was hidden by an admin
          </>
        ),
        body: "",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
      };

    case "plan_invited": {
      const cityName = row.itinerary?.city ?? "your city";
      return {
        icon: "calendar",
        title: (
          <>
            {bold(name)} invited you to a plan in {cityName}
          </>
        ),
        body: row.itinerary?.date
          ? formatPlanDate(row.itinerary.date)
          : "Tap to view",
        href: itineraryHref(row),
        actorAvatar: avatar,
        actorName: name,
      };
    }

    case "recommendation_published": {
      // Celebrates the user's contribution — the space they recommended is
      // now live in the guide. Space name bolded for parity with `new_spot`.
      const recName = row.recommendation?.name || row.spot?.name || "Your recommendation";
      return {
        icon: "award",
        title: (
          <>
            {bold(recName)} is live — thanks for the recommendation
          </>
        ),
        body: "Tap to view in the guide",
        href: spotHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.spot?.image ?? null,
      };
    }

    case "new_spot": {
      const catLine = formatCategoryLine(row.spot?.category, row.spot?.subcategory);
      // Phrasing signals editorial endorsement: presence in the curated
      // guide = curator approval. Space name is inline-semibold so the
      // subject of the sentence reads as the headline, not buried in the
      // verb phrase.
      const spotName = row.spot?.name ?? "A new space";
      return {
        icon: "compass",
        title: <>{bold(spotName)} was added to the guide</>,
        body: catLine || row.spot?.neighborhood || row.spot?.city || "",
        href: spotHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.spot?.image ?? null,
      };
    }

    case "new_event":
      return {
        icon: "calendar",
        title: (
          <>
            {bold(row.event?.title ?? "A new event")} was added to the calendar
          </>
        ),
        body: row.event?.neighborhood ?? row.event?.city ?? "",
        href: eventHref(row),
        actorAvatar: null,
        actorName: null,
        coverImage: row.event?.image ?? null,
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
