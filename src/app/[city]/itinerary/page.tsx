// Planner entrypoint. The draft lives in localStorage, so a small
// client shim reads it via the hook and mounts ItineraryPlanner with
// the hydrated state. Spots come from the server (so we don't re-fetch
// them on the client), and auth is checked server-side so we know
// whether to expose the Save button.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpotsByCity } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { cityNameFromSlug, isValidCitySlug } from "@/lib/cities";
import Navbar from "@/components/Navbar";
import ItineraryPlannerClient from "./ItineraryPlannerClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  if (!isValidCitySlug(citySlug)) return { title: "Not Found" };
  const cityName = cityNameFromSlug(citySlug)!;
  return {
    title: `Build a plan · ${cityName}`,
    description: `Plan a multi-stop night out across the best spaces in ${cityName}.`,
  };
}

export default async function ItineraryPlannerPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  if (!isValidCitySlug(citySlug)) notFound();
  const cityName = cityNameFromSlug(citySlug)!;

  const [spots, user] = await Promise.all([
    getSpotsByCity(cityName),
    getSession(),
  ]);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 min-h-0">
        <ItineraryPlannerClient
          citySlug={citySlug}
          cityName={cityName}
          spots={spots}
          canSave={!!user}
        />
      </div>
    </div>
  );
}
