"use client";

// Client shim: reads the localStorage draft via useItineraryDraft and
// hands it to ItineraryPlanner as initial state. Without this wrapper,
// the planner would either SSR with an empty items array (flash) or
// have to re-read the draft itself on every render.
//
// V1: the active planner ignores date/activities/vibes/neighborhoods,
// so we thread only name + items through. The draft hook still carries
// those fields (for v2 compat) — they're just unread.
//
// No hydration sentinel needed: `useItineraryDraft` uses
// `useSyncExternalStore` with a server snapshot that returns the same
// empty draft as the first client render, so React handles the
// SSR → client transition without a mismatch.

import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import type { Spot } from "@/lib/types";
import ItineraryPlanner from "@/components/itinerary/ItineraryPlanner";

export default function ItineraryPlannerClient({
  citySlug,
  cityName,
  spots,
  canSave,
}: {
  citySlug: string;
  cityName: string;
  spots: Spot[];
  canSave: boolean;
}) {
  const { draft } = useItineraryDraft(citySlug);

  return (
    <ItineraryPlanner
      citySlug={citySlug}
      cityName={cityName}
      spots={spots}
      canSave={canSave}
      persistAsDraft={true}
      initial={{
        name: draft.name,
        items: draft.items.map((it) => ({
          spotId: it.spotId,
          timeLabel: it.timeLabel ?? null,
        })),
      }}
    />
  );
}
