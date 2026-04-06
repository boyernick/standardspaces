export type Category =
  | "dining"
  | "drinks"
  | "members"
  | "wellness"
  | "coffee"
  | "shopping"
  | "hotels";

export const CATEGORY_LABELS: Record<Category, string> = {
  coffee: "Café",
  dining: "Dining",
  drinks: "Drinks",
  wellness: "Wellness",
  shopping: "Shops",
  members: "Venues",
  hotels: "Stays",
};

// Subcategories — the type of place within each category
export const SUBCATEGORIES: Record<Category, string[]> = {
  coffee: [
    "Specialty coffee", "Roastery", "Café", "Matcha", "Tea house",
    "Bakery café", "Espresso bar", "Coffee lab",
    "Bakery", "Patisserie", "Juice bar", "Açaí bar",
  ],
  dining: [
    "Fine dining", "Omakase", "Seafood", "Tasting menu",
    "Steakhouse", "Italian", "French", "Japanese", "Mediterranean",
    "Latin American", "Mexican", "Peruvian", "Asian fusion", "Thai",
    "Indian", "Middle Eastern", "Greek", "Farm-to-table", "Raw bar",
    "Sushi", "Tapas", "Contemporary American", "New American",
    "Southern", "Barbecue", "Pizza", "Vegan", "Chef's table",
  ],
  drinks: [
    "Cocktail bar", "Wine bar", "Speakeasy", "Nightclub", "Lounge",
    "Rooftop bar", "Dive bar", "Tiki bar", "Mezcal bar", "Sake bar",
    "Champagne bar", "Beer garden", "Brewery", "Sports bar",
    "Jazz bar", "Piano bar", "Cigar lounge", "Pool bar", "Day club",
  ],
  wellness: [
    "Gym", "Recovery", "Spa", "Yoga", "Pilates", "Barbershop", "Salon",
    "CrossFit", "Boxing", "Martial arts", "Personal training",
    "Cold plunge", "Sauna", "Cryotherapy", "IV therapy", "Medspa",
    "Float therapy", "Massage", "Facial studio", "Nail studio",
    "Acupuncture", "Chiropractic", "Physical therapy", "Cycling studio",
    "Dance studio", "Climbing gym", "Tennis club", "Golf",
  ],
  shopping: [
    "Fashion", "Jewelry", "Watches", "Art gallery", "Vintage",
    "Menswear", "Womenswear", "Streetwear", "Designer", "Boutique",
    "Sneakers", "Eyewear", "Leather goods", "Home décor", "Furniture",
    "Bookshop", "Record shop", "Plant shop", "Fragrance",
    "Concept store", "Tailoring", "Bridal", "Swimwear", "Athleisure",
  ],
  members: [
    "Social club", "Business club", "Event space",
    "Coworking", "Private dining", "Wine club", "Cigar club",
    "Beach club", "Country club", "Networking club", "Arts club",
    "Supper club",
  ],
  hotels: [
    "Boutique hotel", "Resort", "Villa",
    "Design hotel", "Historic hotel", "Beach hotel", "Luxury hotel",
    "Aparthotel", "Hostel", "Bed & breakfast", "Eco lodge",
    "Wellness retreat", "Casino hotel",
  ],
};

// Vibes — cross-category mood/experience tags
export const VIBES: string[] = [
  "Date night",
  "Late night",
  "Special occasion",
  "Brunch",
  "Business dinner",
  "Group friendly",
  "Outdoor seating",
  "Rooftop",
  "Waterfront",
  "Live music",
  "People watching",
  "Hidden gem",
  "Sceney",
  "Chill",
  "Romantic",
  "Power lunch",
  "Pre-game",
  "After party",
  "Day drinking",
  "Sunday funday",
  "Solo friendly",
  "Tourist must-do",
  "Local favorite",
  "Aperitivo",
  "Natural wine",
  "Wellness ritual",
];

// Top 12 vibes for the command menu grid
export const TOP_VIBES: string[] = [
  "Date night",
  "Late night",
  "Special occasion",
  "Brunch",
  "Rooftop",
  "Hidden gem",
  "Romantic",
  "Aperitivo",
  "Live music",
  "Solo friendly",
  "Local favorite",
  "Power lunch",
];

// Ordered by frequency of use
export const CATEGORY_ORDER: Category[] = [
  "coffee",
  "dining",
  "drinks",
  "wellness",
  "shopping",
  "members",
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
}

export interface EventRecord {
  id: string;
  spot_id: string;
  host_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string;
  city: string;
  capacity: number | null;
  price_cents: number;
  currency: string;
  visibility: "public" | "private";
  status: "published" | "cancelled" | "hidden";
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
