// Saved-plan polish page. Auth-gated; RLS gates visibility so owners and
// invitees both see their plan, while writes stay owner-only. Building a
// plan happens on the city page via `ItineraryTray` — this surface is
// where the user picks a date, invites friends, copies the share link,
// and optionally tweaks the stop order.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  getItinerary,
  getItineraryInvitees,
} from "@/app/actions/itineraries";
import { getSpotsByCity } from "@/lib/data";
import { cityNameFromSlug, isValidCitySlug } from "@/lib/cities";
import PageShell from "@/components/ui/PageShell";
import SavedPlanEditor from "@/components/itinerary/SavedPlanEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const rec = await getItinerary(id);
  const title = rec?.date
    ? new Date(`${rec.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Plan";
  return { title };
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
  // row's city. If it's mismatched (user hand-edited URL), 404 rather
  // than mixing spots across cities.
  if (rec.city.toLowerCase() !== cityName.toLowerCase()) notFound();

  // Parallel fetches — spots don't depend on invitees and vice versa.
  const isOwner = rec.isOwner !== false;
  const [spots, invitees] = await Promise.all([
    getSpotsByCity(cityName),
    // `getItineraryInvitees` is owner-gated server-side; skip the round
    // trip for invitees — they see only the presence/absence of other
    // invitees via the component's `invitees.length > 0` branch.
    isOwner ? getItineraryInvitees(id) : Promise.resolve([]),
  ]);

  // The saved-plan editor provides its own max-width container and sticky
  // action bar. Mount it inside PageShell with `maxWidth="lg"` so the
  // editor's own inner `max-w-2xl` constrains width, and the shell's
  // `overflow-y-auto` gives us scrolling for the sticky bar to not clip
  // content.
  return (
    <PageShell maxWidth="lg">
      <SavedPlanEditor
        plan={rec}
        citySlug={citySlug}
        cityName={cityName}
        citySpots={spots}
        initialInvitees={invitees}
      />
    </PageShell>
  );
}
