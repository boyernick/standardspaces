export type Category =
  | "dining"
  | "drinks"
  | "members"
  | "wellness"
  | "coffee"
  | "shopping"
  | "grooming"
  | "hotels";

export const CATEGORY_LABELS: Record<Category, string> = {
  coffee: "Coffee",
  dining: "Dining",
  drinks: "Drinks",
  wellness: "Wellness",
  grooming: "Grooming",
  shopping: "Shopping",
  members: "Members Clubs",
  hotels: "Hotels",
};

// Ordered by frequency of use
export const CATEGORY_ORDER: Category[] = [
  "coffee",
  "dining",
  "drinks",
  "wellness",
  "grooming",
  "shopping",
  "members",
  "hotels",
];

export interface Spot {
  id: string;
  name: string;
  category: Category;
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
