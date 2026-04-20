// Saved-plans hub. Authenticated-only; mirrors /events' shape
// (requireAuth → load via server action → thread into a client list).
// Plans span cities, so this page is global — no [city] segment.
//
// Thumbnails: for each plan, pre-resolve up to the first four stops'
// photos so the PlanCard can render a photo grid without re-fetching.
// IDs are deduped across all plans before the batched spot lookup so a
// user with many plans sharing stops costs one round trip.

import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getMyItineraries } from "@/app/actions/itineraries";
import { getSpotsByIds } from "@/lib/data";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import PlansHubClient from "./PlansHubClient";

export const metadata: Metadata = { title: "Plans" };

// Max photos rendered per card. Kept here (not in the component) so the
// server fetch can stay in sync with the client-side grid.
const MAX_CARD_THUMBS = 4;

export default async function PlansHubPage() {
  await requireAuth();

  const plans = await getMyItineraries();

  // Batch-fetch every candidate-thumb spot in one query.
  const candidateIds = plans.flatMap((p) =>
    p.items.slice(0, MAX_CARD_THUMBS).map((it) => it.spotId),
  );
  const uniqueIds = [...new Set(candidateIds)];
  const spots = uniqueIds.length ? await getSpotsByIds(uniqueIds) : [];
  const imageById = new Map<string, string | null>();
  for (const s of spots) imageById.set(s.id, s.images?.[0] ?? null);

  // Pre-resolve each plan's ordered thumbnail list on the server, then
  // hand the client component just what it needs to render. Stops whose
  // spot has no image silently drop out — the card lays itself out
  // around however many photos actually resolved.
  const thumbsByPlan: Record<string, string[]> = {};
  for (const p of plans) {
    thumbsByPlan[p.id] = p.items
      .slice(0, MAX_CARD_THUMBS)
      .map((it) => imageById.get(it.spotId) ?? null)
      .filter((t): t is string => !!t);
  }

  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Plans" />
      <PlansHubClient plans={plans} thumbsByPlan={thumbsByPlan} />
    </PageShell>
  );
}
