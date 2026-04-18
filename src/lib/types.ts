export type Category =
  | "dining"
  | "drinks"
  | "members"
  | "wellness"
  | "coffee"
  | "shopping"
  | "hotels";

export const CATEGORY_LABELS: Record<Category, string> = {
  coffee: "Cafés",
  dining: "Dining",
  drinks: "Drinks",
  wellness: "Wellness",
  shopping: "Shops",
  members: "Venues",
  hotels: "Stays",
};

/**
 * Subcategory groupings — used by the city sidebar to render visually
 * grouped dropdowns for the categories that span very different concepts
 * (Wellness mixes fitness/recovery/beauty/health, Shops mixes apparel/
 * specialty/lifestyle/art, Dining mixes cuisines and formats). For
 * categories not in this map the sidebar renders a single flat list.
 *
 * Concatenated in display order to produce the canonical flat
 * `SUBCATEGORIES[category]` list, which still backs the admin chip
 * selector and the scraper's keyword inference.
 */
export const SUBCATEGORY_GROUPS: Partial<Record<Category, { label: string; items: string[] }[]>> = {
  dining: [
    {
      label: "Cuisine",
      items: [
        "Italian", "French", "Japanese", "Korean", "Chinese", "Vietnamese",
        "Thai", "Indian", "Mediterranean", "Greek", "Middle Eastern", "Spanish",
        "Mexican", "Peruvian", "Latin American", "Caribbean",
        "Contemporary American", "New American", "Southern",
      ],
    },
    {
      label: "Format",
      items: [
        "Fine dining", "Omakase", "Tasting menu", "Chef's table", "Steakhouse",
        "Seafood", "Raw bar", "Sushi", "Pizza", "Burger", "Sandwich shop",
        "BBQ", "Farm-to-table", "Vegan",
      ],
    },
  ],
  wellness: [
    {
      label: "Fitness",
      items: [
        "Gym", "CrossFit", "Boxing", "Martial arts", "Personal training",
        "Pilates", "Yoga", "Cycling studio", "Dance studio", "Climbing gym",
        "Tennis club", "Padel club", "Golf",
      ],
    },
    {
      label: "Recovery",
      items: ["Sauna", "Cold plunge", "Cryotherapy", "Float therapy", "IV therapy", "Recovery"],
    },
    {
      label: "Beauty",
      items: [
        "Spa", "Medspa", "Massage", "Facial studio", "Nail studio",
        "Hair salon", "Barbershop", "Brow & lash",
      ],
    },
    {
      label: "Health",
      items: ["Acupuncture", "Chiropractic", "Physical therapy"],
    },
  ],
  shopping: [
    {
      label: "Apparel",
      items: [
        "Menswear", "Womenswear", "Designer", "Streetwear", "Vintage",
        "Sneakers", "Athleisure", "Swimwear", "Bridal", "Boutique", "Tailoring",
      ],
    },
    {
      label: "Specialty",
      items: ["Jewelry", "Watches", "Eyewear", "Leather goods", "Fragrance"],
    },
    {
      label: "Lifestyle",
      items: [
        "Concept store", "Home décor", "Furniture", "Plant shop", "Florist",
        "Bookshop", "Record shop", "Stationery",
      ],
    },
    {
      label: "Art",
      items: ["Art gallery"],
    },
  ],
};

// Subcategories — the type of place within each category. For grouped
// categories this is derived from SUBCATEGORY_GROUPS so the two never
// drift apart.
export const SUBCATEGORIES: Record<Category, string[]> = {
  coffee: [
    "Specialty coffee", "Roastery", "Espresso bar", "Coffee lab",
    "Matcha bar", "Tea house",
    "Bakery café", "Patisserie",
    "Juice bar", "Açaí bar", "Smoothie bar",
    "Breakfast spot",
  ],
  dining: SUBCATEGORY_GROUPS.dining!.flatMap((g) => g.items),
  drinks: [
    "Cocktail bar", "Speakeasy", "Hotel bar", "Lounge",
    "Wine bar", "Natural wine bar", "Champagne bar",
    "Sake bar", "Mezcal bar", "Whiskey bar", "Tiki bar",
    "Beer garden", "Brewery",
    "Rooftop bar", "Beach bar",
    "Sports bar", "Dive bar",
    "Nightclub",
    "Jazz bar", "Piano bar", "Cigar lounge",
  ],
  wellness: SUBCATEGORY_GROUPS.wellness!.flatMap((g) => g.items),
  shopping: SUBCATEGORY_GROUPS.shopping!.flatMap((g) => g.items),
  members: [
    "Social club", "Business club", "Beach club", "Day club",
    "Country club", "Wine club", "Cigar club", "Arts club", "Supper club",
    "Private dining", "Coworking", "Event space",
  ],
  hotels: [
    "Boutique hotel", "Design hotel", "Luxury hotel",
    "Resort", "Beach resort", "Wellness retreat", "Eco lodge",
    "Historic hotel", "Aparthotel", "Villa", "Bed & breakfast", "Glamping",
  ],
};

// Vibes — cross-category mood/experience tags. One bucket, but ordered
// by intent so the sidebar's count-desc sort can fall back to a sensible
// canonical order for ties.
export const VIBES: string[] = [
  // Occasion
  "Date night",
  "Special occasion",
  "Business dinner",
  "Power lunch",
  "Brunch",
  "Late night",
  "Sunday funday",
  "After party",
  // Group
  "Solo friendly",
  "Group friendly",
  "Family friendly",
  "Pet friendly",
  // Setting
  "Outdoor",
  "Rooftop",
  "Waterfront",
  "Garden",
  "Intimate",
  "Lively",
  // Programming
  "Live music",
  // Identity
  "Hidden gem",
  "Local favorite",
  "Iconic",
  "Tourist must-do",
  "Romantic",
  "Sceney",
];

// Top 12 vibes for the command menu grid
export const TOP_VIBES: string[] = [
  "Date night",
  "Special occasion",
  "Brunch",
  "Late night",
  "Rooftop",
  "Outdoor",
  "Live music",
  "Hidden gem",
  "Romantic",
  "Solo friendly",
  "Local favorite",
  "Power lunch",
];

// --- Activities (itinerary planner v2) ------------------------------------
//
// An "activity" is the user's answer to "what are we doing?" (dinner,
// brunch, cocktails, date night…). It's a separate dimension from
// `vibes`, which answers "how should it feel?" (rooftop, intimate,
// romantic…). In the planner UI the two live in separate chip rows so
// the criteria feel principled rather than arbitrary.
//
// Under the hood each activity maps to a *required* category filter and
// an optional set of vibe bonuses that boost matching spots during
// ranking. Spot data is untouched — we're just layering a labeled
// dimension on top of the existing `Category[]` + `vibes[]` fields.
//
// The `id` is stable (stored in the DB and URL), so we can freely edit
// `label` or re-order entries without breaking saved plans.
export type Activity = {
  id: string;
  label: string;
  categories: Category[];
  vibes: string[];
};

export const ACTIVITIES: Activity[] = [
  { id: "dinner",   label: "Dinner",           categories: ["dining"],          vibes: [] },
  { id: "brunch",   label: "Brunch",           categories: ["dining"],          vibes: ["Brunch"] },
  { id: "lunch",    label: "Lunch",            categories: ["dining"],          vibes: ["Power lunch"] },
  { id: "drinks",   label: "Drinks",           categories: ["drinks"],          vibes: [] },
  { id: "coffee",   label: "Coffee",           categories: ["coffee"],          vibes: [] },
  { id: "date",     label: "Date night",       categories: ["dining", "drinks"], vibes: ["Date night", "Romantic"] },
  { id: "late",     label: "Late night",       categories: ["drinks"],          vibes: ["Late night"] },
  { id: "special",  label: "Special occasion", categories: ["dining"],          vibes: ["Special occasion"] },
  { id: "party",    label: "After party",      categories: ["drinks"],          vibes: ["After party", "Sceney"] },
  { id: "wellness", label: "Wellness",         categories: ["wellness"],        vibes: [] },
  { id: "shop",     label: "Shopping",         categories: ["shopping"],        vibes: [] },
];

// Lookup map for O(1) access by id — useful in the planner's renderers.
export const ACTIVITIES_BY_ID: Record<string, Activity> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, a]),
);

// Vibes the step-3 "Feel" picker surfaces. The occasion-shaped entries
// (Date night, Brunch, Late night…) are now promoted to ACTIVITIES, so
// we filter them out here to keep the vibe picker strictly about
// sensory / audience mood and avoid double-exposing the same concept.
export const VIBE_MOODS: string[] = VIBES.filter(
  (v) =>
    ![
      "Date night",
      "Brunch",
      "Late night",
      "After party",
      "Special occasion",
      "Business dinner",
      "Power lunch",
      "Sunday funday",
    ].includes(v),
);

// Editorial order — drives the city-page filter pill row left-to-right.
export const CATEGORY_ORDER: Category[] = [
  "dining",
  "drinks",
  "coffee",
  "members",
  "shopping",
  "wellness",
  "hotels",
];

export interface Spot {
  id: string;
  name: string;
  category: Category[];
  subcategory?: string[];
  vibes?: string[];
  neighborhood: string;
  city: string;
  description: string;
  address: string;
  images: string[];
  lng: number;
  lat: number;
  // Logistics
  hours?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  priceRange?: string;
  dressCode?: string;
  reservations?: string;
  parking?: string;
  // Booking & extras
  bookingUrl?: string;
  bookingPlatform?: string;
  menuUrl?: string;
  /** @deprecated Use the `events` table instead. Retained for legacy data only. */
  events?: { name: string; date: string; description: string }[];
  /**
   * ISO timestamp set when an admin flips the "Mark as new" toggle in the
   * listing edit form. The `<NewBadge />` renders iff this is within the
   * `NEW_WINDOW_MS` window (7 days) of `Date.now()`. Null/undefined when
   * the spot has never been marked or the admin cleared the toggle.
   */
  markedNewAt?: string | null;
  /** ISO timestamp; sourced from `spots.created_at`. Used by the "Newest"
   * sort in the city sidebar. */
  createdAt?: string;
}

export interface EventRecord {
  id: string;
  spot_id: string;
  host_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  images: string[];
  starts_at: string;
  ends_at: string;
  city: string;
  capacity: number | null;
  price_cents: number;
  currency: string;
  visibility: "public" | "private";
  status: "published" | "cancelled" | "hidden";
  age_restriction: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: "going" | "waitlist" | "cancelled";
  stripe_payment_intent_id: string | null;
  paid_amount_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventInvite {
  id: string;
  event_id: string;
  user_id: string;
  invited_by: string;
  created_at: string;
}

// --- Itineraries -----------------------------------------------------------

/**
 * Hard cap per plan. Keeps the share URL under ~200 chars, the numbered
 * pins legible on mobile, and is enforced both in the DB (CHECK on
 * `position < 8`) and in `useItineraryDraft`. Bumping this requires
 * a matching DB migration.
 */
export const ITINERARY_MAX_STOPS = 8;

/** One stop in a draft itinerary — lives in localStorage. The time is
 *  stored as `HHMM` (24-hour, e.g. "1900") for a stable URL format;
 *  display formatting is done via `formatTime`. */
export interface ItineraryDraftItem {
  spotId: string;
  /** "HHMM" or undefined — no label set. */
  timeLabel?: string;
}

/** The whole draft. `city` scopes the plan to a single city page; we
 *  prompt on cross-city replacement rather than merging.
 *
 *  v2: carries the planner's criteria state so reload / cross-tab sync
 *  restores the full authoring context, not just the chosen stops.
 *  `date` is ISO yyyy-mm-dd (no time component). `activities` stores
 *  stable `Activity.id` values, not labels. All four are defaulted so
 *  older v1 drafts load cleanly. */
export interface ItineraryDraft {
  city: string;
  name: string;
  items: ItineraryDraftItem[];
  /** v2: ISO yyyy-mm-dd, or null if no date picked yet. */
  date: string | null;
  /** v2: selected `Activity.id`s. */
  activities: string[];
  /** v2: selected vibes from `VIBE_MOODS`. */
  vibes: string[];
  /** v2: selected neighborhood names. */
  neighborhoods: string[];
}

/** Persisted row from `user_itineraries`.
 *
 *  v2 adds the four criteria columns (plan_date / activities / vibes /
 *  neighborhoods). All default to empty / null on v1 rows. */
export interface Itinerary {
  id: string;
  userId: string;
  city: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ItineraryItem[];
  date: string | null;
  activities: string[];
  vibes: string[];
  neighborhoods: string[];
}

/** Persisted row from `user_itinerary_items`. */
export interface ItineraryItem {
  spotId: string;
  position: number;
  timeLabel: string | null;
}
