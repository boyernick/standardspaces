import type { NotificationRow } from "@/lib/notifications-render";

/**
 * Seed rows covering every notification type in the catalog.
 *
 * Activated by visiting `/notifications?mock=1` — used to preview the
 * rendering of each notification shape without having to trigger every
 * underlying action end-to-end.
 */
const now = Date.now();
const minutes = (n: number) => new Date(now - n * 60 * 1000).toISOString();
const hours = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString();
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const actorMaya = {
  id: "mock-user-maya",
  first_name: "Maya",
  last_name: "Chen",
  avatar_url:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces",
};

const actorJordan = {
  id: "mock-user-jordan",
  first_name: "Jordan",
  last_name: "Rivera",
  avatar_url:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces",
};

const actorPriya = {
  id: "mock-user-priya",
  first_name: "Priya",
  last_name: "Shah",
  avatar_url:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces",
};

const actorLuca = {
  id: "mock-user-luca",
  first_name: "Luca",
  last_name: "Bianchi",
  avatar_url:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces",
};

const spotMarys = {
  id: "mary-lous",
  name: "Mary Lou's",
  city: "Miami",
  neighborhood: "Little Havana",
};

const spotSunset = {
  id: "sunset-harbor-club",
  name: "Sunset Harbor Club",
  city: "Miami",
  neighborhood: "Sunset Harbor",
  image:
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=240&h=240&fit=crop",
  category: ["drinks"],
  subcategory: ["speakeasy"],
};

const eventRooftop = {
  id: "mock-event-rooftop",
  title: "Rooftop listening session",
  city: "Miami",
  neighborhood: "Brickell",
  image:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=240&h=240&fit=crop",
};

const eventGallery = {
  id: "mock-event-gallery",
  title: "Wynwood gallery walk",
  city: "Miami",
  neighborhood: "Wynwood",
  image:
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=240&h=240&fit=crop",
};

const eventDinner = {
  id: "mock-event-dinner",
  title: "Friday supper club",
  city: "Miami",
  neighborhood: "Design District",
  image:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=240&h=240&fit=crop",
};

function base(
  id: string,
  type: NotificationRow["type"],
  created_at: string,
  overrides: Partial<NotificationRow> = {},
): NotificationRow {
  return {
    id,
    type,
    user_id: "mock-recipient",
    actor_id: null,
    spot_id: null,
    event_id: null,
    recommendation_id: null,
    metadata: {},
    read_at: null,
    created_at,
    ...overrides,
  };
}

export const MOCK_NOTIFICATIONS: NotificationRow[] = [
  // --- Today ---
  base("mock-1", "followed_you", minutes(4), {
    actor_id: actorMaya.id,
    actor: actorMaya,
  }),
  base("mock-2", "follower_checkin", minutes(22), {
    actor_id: actorJordan.id,
    actor: actorJordan,
    spot_id: spotMarys.id,
    spot: spotMarys,
  }),
  base("mock-3", "follower_rsvp_same_event", minutes(55), {
    actor_id: actorPriya.id,
    actor: actorPriya,
    event_id: eventRooftop.id,
    event: eventRooftop,
  }),
  base("mock-4", "event_invited", hours(2), {
    event_id: eventGallery.id,
    event: eventGallery,
  }),
  base("mock-5", "your_event_new_rsvp", hours(3), {
    actor_id: actorLuca.id,
    actor: actorLuca,
    event_id: eventDinner.id,
    event: eventDinner,
  }),
  base("mock-6", "your_event_at_capacity", hours(4), {
    event_id: eventDinner.id,
    event: eventDinner,
  }),
  base("mock-7", "event_reminder_1h", hours(5), {
    event_id: eventRooftop.id,
    event: eventRooftop,
    read_at: hours(4).toString(),
  }),

  // --- This week ---
  base("mock-8", "recommendation_published", days(1), {
    spot_id: spotSunset.id,
    spot: spotSunset,
    recommendation_id: "mock-rec-1",
    recommendation: { id: "mock-rec-1", name: spotSunset.name },
  }),
  base("mock-9", "new_spot", days(1), {
    spot_id: spotSunset.id,
    spot: spotSunset,
  }),
  base("mock-10", "new_event", days(2), {
    event_id: eventGallery.id,
    event: eventGallery,
  }),
  base("mock-11", "referred_friend_joined", days(2), {
    actor_id: actorLuca.id,
    actor: actorLuca,
    read_at: days(1),
  }),
  base("mock-12", "event_waitlist_promoted", days(3), {
    event_id: eventRooftop.id,
    event: eventRooftop,
    read_at: days(2),
  }),
  base("mock-13", "event_updated", days(3), {
    event_id: eventDinner.id,
    event: eventDinner,
    read_at: days(2),
  }),
  base("mock-14", "event_reminder_24h", days(4), {
    event_id: eventRooftop.id,
    event: eventRooftop,
    read_at: days(3),
  }),

  // --- Earlier ---
  base("mock-15", "your_event_rsvp_cancelled", days(9), {
    actor_id: actorJordan.id,
    actor: actorJordan,
    event_id: eventDinner.id,
    event: eventDinner,
    read_at: days(8),
  }),
  base("mock-16", "event_cancelled", days(12), {
    event_id: eventGallery.id,
    event: eventGallery,
    read_at: days(11),
  }),
  base("mock-17", "your_event_taken_down", days(20), {
    event_id: eventDinner.id,
    event: eventDinner,
    read_at: days(19),
  }),
];
