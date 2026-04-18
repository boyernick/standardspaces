// Public, read-only share view (v1).
// URL shape:
//   /[city]/itinerary/share
//     ?s=<spotId>[:HHMM](,<spotId>[:HHMM])*
//     &n=<name>
//
// The parser skips malformed tokens (bogus slugs, bad times) rather than
// throwing, so a tampered URL still renders a valid subset. Non-matching
// spot IDs are dropped at the DB step. Empty result → the view shows an
// "empty or expired" state with a link back to the city page.
//
// v2 additional params (d / act / v / a) are still parsed by the codec
// and ignored here — the v1 view doesn't surface criteria. Keeping the
// parser lenient means v2 share links don't 500 when opened on v1.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpotsByIds } from "@/lib/data";
import { cityNameFromSlug, isValidCitySlug } from "@/lib/cities";
import { parseItineraryUrl } from "@/lib/itinerary-url";
import Navbar from "@/components/Navbar";
import ItineraryView from "@/components/itinerary/ItineraryView";

type SearchParams = Promise<{
  s?: string | string[];
  n?: string | string[];
}>;

function firstValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  if (!isValidCitySlug(citySlug)) return { title: "Not Found" };
  const cityName = cityNameFromSlug(citySlug)!;
  const sp = await searchParams;
  const { name } = parseItineraryUrl({
    s: firstValue(sp.s),
    n: firstValue(sp.n),
  });
  const title = name ? `${name} · ${cityName}` : `A plan in ${cityName}`;
  return {
    title,
    description: `A shared itinerary of spaces in ${cityName}.`,
    openGraph: {
      title,
      description: `A shared itinerary of spaces in ${cityName}.`,
    },
  };
}

export default async function ItinerarySharePage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: SearchParams;
}) {
  const { city: citySlug } = await params;
  if (!isValidCitySlug(citySlug)) notFound();
  const cityName = cityNameFromSlug(citySlug)!;

  const sp = await searchParams;
  const parsed = parseItineraryUrl({
    s: firstValue(sp.s),
    n: firstValue(sp.n),
  });

  const uniqueIds = Array.from(new Set(parsed.items.map((it) => it.spotId)));
  const resolvedSpots = uniqueIds.length
    ? await getSpotsByIds(uniqueIds)
    : [];

  // Keep only items whose spot we successfully resolved — bogus slugs
  // silently drop here. The component renders an empty-state when the
  // remaining list is empty.
  const resolvedSet = new Set(resolvedSpots.map((s) => s.id));
  const items = parsed.items.filter((it) => resolvedSet.has(it.spotId));

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 min-h-0">
        <ItineraryView
          citySlug={citySlug}
          cityName={cityName}
          name={parsed.name}
          items={items.map((it) => ({
            spotId: it.spotId,
            timeLabel: it.timeLabel ?? null,
          }))}
          spots={resolvedSpots}
        />
      </div>
    </div>
  );
}
