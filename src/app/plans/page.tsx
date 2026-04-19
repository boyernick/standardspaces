// Saved-plans hub. Authenticated-only; mirrors /events' shape
// (requireAuth → load via server action → thread into a client list).
// Plans span cities, so this page is global — no [city] segment. Each
// card's thumbnail comes from the plan's first stop, resolved here so
// the client doesn't re-fetch spots.

import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getMyItineraries } from "@/app/actions/itineraries";
import { getSpotsByIds } from "@/lib/data";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import PlansHubClient from "./PlansHubClient";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansHubPage() {
  await requireAuth();

  const plans = await getMyItineraries();

  // Resolve first-stop thumbnails for the hero image on each card.
  // Dedupe ids before fetching so a user with five plans all starting
  // at Baby Jane only costs one row lookup.
  const firstSpotIds = plans
    .map((p) => p.items[0]?.spotId)
    .filter((id): id is string => !!id);
  const uniqueIds = [...new Set(firstSpotIds)];
  const spots = uniqueIds.length ? await getSpotsByIds(uniqueIds) : [];
  const thumbById: Record<string, string | null> = {};
  for (const s of spots) thumbById[s.id] = s.images?.[0] ?? null;

  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Plans" />
      <PlansHubClient plans={plans} thumbById={thumbById} />
    </PageShell>
  );
}
