"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getPopulatedCities(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("spots").select("city");
  if (!data) return [];
  return [...new Set(data.map((r) => r.city as string))];
}
