export type Category =
  | "restaurant"
  | "bar"
  | "club"
  | "gym"
  | "coffee"
  | "clothing"
  | "hotel"
  | "spa";

export const CATEGORY_LABELS: Record<Category, string> = {
  restaurant: "Restaurants",
  bar: "Bars",
  club: "Clubs",
  gym: "Gyms",
  coffee: "Coffee",
  clothing: "Clothing",
  hotel: "Hotels",
  spa: "Spas",
};

export interface Spot {
  id: string;
  name: string;
  category: Category;
  neighborhood: string;
  city: string;
  description: string;
  address: string;
  image: string;
}
