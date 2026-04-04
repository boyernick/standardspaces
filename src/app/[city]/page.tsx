import { notFound } from "next/navigation";
import { getSpotsByCity } from "@/lib/data";
import { requireAuth, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cityNameFromSlug, isValidCitySlug, citySlugFromName } from "@/lib/cities";
import CityClient from "./CityClient";

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  if (!isValidCitySlug(citySlug)) notFound();

  const cityName = cityNameFromSlug(citySlug)!;

  const user = await requireAuth();
  const profile = await getProfile();
  const userCitySlug = profile?.city ? citySlugFromName(profile.city) : "miami";

  // Parallel fetch: spots + favorites (reuse auth from requireAuth)
  const supabase = await createClient();
  const [spots, { data: favData }] = await Promise.all([
    getSpotsByCity(cityName),
    supabase.from("user_favorites").select("spot_id").eq("user_id", user.id),
  ]);

  const favoritedSpotIds = (favData ?? []).map((r) => r.spot_id);

  return (
    <CityClient
      spots={spots}
      favoritedSpotIds={favoritedSpotIds}
      cityName={cityName}
      citySlug={citySlug}
      userCitySlug={userCitySlug}
    />
  );
}
