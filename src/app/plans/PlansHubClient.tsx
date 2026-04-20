"use client";

// Client hub for /plans: renders the user's saved itineraries as a
// single flex-wrap list of PlanCards. Deletion lives inside the
// saved-plan editor now, so the hub is pure navigation.

import { Map as MapIcon } from "lucide-react";
import type { Itinerary } from "@/lib/types";
import EmptyState from "@/components/ui/EmptyState";
import PlanCard from "@/components/itinerary/PlanCard";

interface Props {
  plans: Itinerary[];
  /** planId → ordered list of stop thumbnails (already filtered for
   *  non-null images). Pre-resolved on the server to avoid a per-card
   *  lookup here. */
  thumbsByPlan: Record<string, string[]>;
}

export default function PlansHubClient({
  plans,
  thumbsByPlan = {},
}: Props) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No saved plans yet"
        body="Add spaces from a city to start a plan, then save it here."
        cta={{ label: "Browse Miami", href: "/miami" }}
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          thumbs={thumbsByPlan[plan.id] ?? []}
        />
      ))}
    </div>
  );
}
