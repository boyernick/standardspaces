import { createAdminClient } from "./supabase/admin";
import { Spot, Category } from "./types";

// Map DB row (snake_case) to app type (camelCase)
function mapRow(row: Record<string, unknown>): Spot {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Category,
    subcategory: row.subcategory as string[] | undefined,
    neighborhood: row.neighborhood as string,
    city: row.city as string,
    description: row.description as string,
    address: row.address as string,
    images: row.images as string[],
    lng: row.lng as number,
    lat: row.lat as number,
    hours: row.hours as string | undefined,
    phone: row.phone as string | undefined,
    website: row.website as string | undefined,
    instagram: row.instagram as string | undefined,
    priceRange: row.price_range as string | undefined,
    dressCode: row.dress_code as string | undefined,
    reservations: row.reservations as string | undefined,
    parking: row.parking as string | undefined,
    bookingUrl: row.booking_url as string | undefined,
    bookingPlatform: row.booking_platform as string | undefined,
    menuUrl: row.menu_url as string | undefined,
    events: (row.events as Spot["events"]) ?? [],
    vibes: row.vibes as string[] | undefined,
  };
}

export async function getSpotsByCity(city: string): Promise<Spot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .ilike("city", city)
    .order("name");

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function getSpotById(id: string): Promise<Spot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching spot:", error);
    return null;
  }

  return data ? mapRow(data) : null;
}

export async function getAllSpotIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spots")
    .select("id");

  if (error) return [];
  return (data ?? []).map((r) => r.id);
}
