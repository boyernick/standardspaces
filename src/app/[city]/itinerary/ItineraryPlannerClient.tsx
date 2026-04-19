"use client";

// Client shim: reads the localStorage draft via useItineraryDraft and
// hands it to ItineraryPlanner as initial state. Without this wrapper,
// the planner would either SSR with an empty items array (flash) or
// have to re-read the draft itself on every render.
//
// The planner reads its full authoring state — including date,
// activities, vibes, and neighborhoods — from `initial`, then owns
// those values in local state and mirrors them back into the draft via
// the hook's setters. Threading them here keeps the reload → restore
// loop lossless.
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
        date: draft.date,
        activities: draft.activities,
        vibes: draft.vibes,
        neighborhoods: draft.neighborhoods,
      }}
    />
  );
}
