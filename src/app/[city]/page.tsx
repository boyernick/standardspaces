import { notFound } from "next/navigation";
import { getSpotsByCity } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { getProfile } from "@/lib/auth";
import { getUserSaves } from "@/app/actions/saves";
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

  await requireAuth();
  const profile = await getProfile();
  const userCitySlug = profile?.city ? citySlugFromName(profile.city) : "miami";

  const [spots, savedSpotIds] = await Promise.all([
    getSpotsByCity(cityName),
    getUserSaves(),
  ]);

  return (
    <CityClient
      spots={spots}
      savedSpotIds={savedSpotIds}
      cityName={cityName}
      citySlug={citySlug}
      userCitySlug={userCitySlug}
    />
  );
}
