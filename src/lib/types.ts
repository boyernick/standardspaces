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
  coffee: [
    "Specialty coffee", "Roastery", "Café", "Matcha", "Tea house",
    "Bakery café", "Espresso bar", "Coffee lab",
  ],
  dining: [
    "Fine dining", "Omakase", "Seafood", "Tasting menu", "Brunch",
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
    "Aperitivo", "Natural wine",
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

// Top 12 subcategories for the command menu vibe grid
export const TOP_SUBCATEGORIES: string[] = [
  "Date night",
  "Late night",
  "Special occasion",
  "Speakeasy",
  "Rooftop bar",
  "Omakase",
  "Brunch",
  "Recovery",
  "Aperitivo",
  "Tasting menu",
  "Raw bar",
  "Cocktail bar",
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
  category: Category;
  subcategory?: string[];
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
