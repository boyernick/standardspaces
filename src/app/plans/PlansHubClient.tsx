"use client";

// Client hub for /plans: renders the user's saved itineraries as a
// single flex-wrap list of PlanCards, each paired with a Delete button
// sibling (same scoping trick EventsHubClient's HostedEventCard uses so
// Delete never also triggers the card's navigation).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon } from "lucide-react";
import type { Itinerary } from "@/lib/types";
import { deleteItinerary } from "@/app/actions/itineraries";
import EmptyState from "@/components/ui/EmptyState";
import PlanCard from "@/components/itinerary/PlanCard";

interface Props {
  plans: Itinerary[];
  thumbById: Record<string, string | null>;
}

export default function PlansHubClient({ plans, thumbById }: Props) {
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
        <PlanRow
          key={plan.id}
          plan={plan}
          thumb={thumbById[plan.items[0]?.spotId ?? ""] ?? null}
        />
      ))}
    </div>
  );
}

function PlanRow({ plan, thumb }: { plan: Itinerary; thumb: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteItinerary(plan.id);
      if (res.success) router.refresh();
    });
  }

  return (
    <div className="w-[260px] shrink-0">
      <PlanCard plan={plan} thumb={thumb} />
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
