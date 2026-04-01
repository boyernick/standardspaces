export type Category =
  | "dining"
  | "drinks"
  | "members"
  | "wellness"
  | "coffee"
  | "shopping"
  | "hotels";

export const CATEGORY_LABELS: Record<Category, string> = {
  coffee: "Coffee",
  dining: "Dining",
  drinks: "Drinks",
  wellness: "Wellness",
  shopping: "Shops",
  members: "Venues",
  hotels: "Stays",
};

// Subcategories for each category
export const SUBCATEGORIES: Record<Category, string[]> = {
  coffee: ["Specialty coffee", "Roastery", "Café"],
  dining: ["Fine dining", "Omakase", "Seafood", "Tasting menu", "Brunch"],
  drinks: ["Cocktail bar", "Wine bar", "Speakeasy", "Nightclub", "Lounge"],
  wellness: ["Gym", "Recovery", "Spa", "Yoga", "Pilates", "Barbershop", "Salon"],
  shopping: ["Fashion", "Jewelry", "Watches", "Art gallery", "Vintage"],
  members: ["Social club", "Business club", "Event space"],
  hotels: ["Boutique hotel", "Resort", "Villa"],
};

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
  category: Category;
  subcategory?: string;
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
  events?: { name: string; date: string; description: string }[];
  tags?: string[];
}
