// Saved-itinerary editor. Auth-gated; RLS guarantees only the owner can
// read/update. Loads the row via the server action, then renders the
// same ItineraryPlanner used for drafts — but with `persistAsDraft=false`
// so local edits don't leak into the city-level draft state.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getItinerary } from "@/app/actions/itineraries";
import { getSpotsByCity } from "@/lib/data";
import { cityNameFromSlug, isValidCitySlug } from "@/lib/cities";
import Navbar from "@/components/Navbar";
import ItineraryPlanner from "@/components/itinerary/ItineraryPlanner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const rec = await getItinerary(id);
  return { title: rec?.name ?? "Plan" };
}

export default async function SavedItineraryPage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  await requireAuth();
  const { city: citySlug, id } = await params;
  if (!isValidCitySlug(citySlug)) notFound();
  const cityName = cityNameFromSlug(citySlug)!;

  const rec = await getItinerary(id);
  if (!rec) notFound();

  // Defensive: a plan in the URL's city slug should match the saved
  // row's city. If it's mismatched (user hand-edited URL), redirect
  // via notFound rather than mixing spots across cities.
  if (rec.city.toLowerCase() !== cityName.toLowerCase()) notFound();

  const spots = await getSpotsByCity(cityName);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 min-h-0">
        <ItineraryPlanner
          citySlug={citySlug}
          cityName={cityName}
          spots={spots}
          canSave={true}
          persistAsDraft={false}
          savedId={rec.id}
          initial={{
            name: rec.name,
            items: rec.items.map((it) => ({
              spotId: it.spotId,
              timeLabel: it.timeLabel,
            })),
          }}
        />
      </div>
    </div>
  );
}
