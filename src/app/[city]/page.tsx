import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSpotsByCity } from "@/lib/data";
import { getUpcomingEventsByCity, getInvitesForUser, getEventsByHost } from "@/lib/events";
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
  const [spots, { data: favData }, { data: wishData }, { data: checkinData }, publicEvents, invites, hosting] = await Promise.all([
    getSpotsByCity(cityName),
    supabase.from("user_favorites").select("spot_id").eq("user_id", user.id),
    supabase.from("user_wishlist").select("spot_id").eq("user_id", user.id),
    supabase.from("user_checkins").select("spot_id").eq("user_id", user.id),
    getUpcomingEventsByCity(cityName, 12),
    getInvitesForUser(user.id),
    getEventsByHost(user.id),
  ]);

  const favoritedSpotIds = (favData ?? []).map((r) => r.spot_id);
  const wishlistedSpotIds = (wishData ?? []).map((r) => r.spot_id);
  const checkedInSpotIds = (checkinData ?? []).map((r) => r.spot_id);

  // Merge in events the user hosts in this city (including private/own events not in public list)
  const now = Date.now();
  const myHostedInCity = hosting.filter(
    (e) => e.city.toLowerCase() === cityName.toLowerCase() && new Date(e.starts_at).getTime() >= now
  );
  const seen = new Set(publicEvents.map((e) => e.id));
  const merged = [...publicEvents];
  for (const e of myHostedInCity) {
    if (!seen.has(e.id)) {
      merged.push(e);
      seen.add(e.id);
    }
  }
  merged.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const upcomingEvents = merged;

  const eventSpotNames: Record<string, string> = {};
  const eventSpotCategories: Record<string, typeof spots[number]["category"]> = {};
  for (const s of spots) {
    eventSpotNames[s.id] = s.name;
    eventSpotCategories[s.id] = s.category;
  }

  return (
    <Suspense fallback={null}>
      <CityClient
        spots={spots}
        favoritedSpotIds={favoritedSpotIds}
        wishlistedSpotIds={wishlistedSpotIds}
        checkedInSpotIds={checkedInSpotIds}
        cityName={cityName}
        citySlug={citySlug}
        userCitySlug={userCitySlug}
        upcomingEvents={upcomingEvents}
        invitedEvents={invites}
        eventSpotNames={eventSpotNames}
        eventSpotCategories={eventSpotCategories}
      />
    </Suspense>
  );
}
