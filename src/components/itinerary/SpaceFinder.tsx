"use client";

// "Pairs well" suggestion block. Two surfaces in one component because
// they share the same underlying candidate ranking and the same card UI:
//
//   1. A ranked list of 3–5 suggestions based on the planner's criteria
//      and (if ≥1 stop is added) the last stop's coordinates.
//   2. A direct-add card when the planner signals the user clicked a
//      candidate pin on the map (via `focusedSpotId`).
//
// Scoring lives entirely here. The caller passes the full spot list for
// the city plus the current criteria + stops, and we produce a ranked
// list. Keeping the scorer co-located with its callers means we can
// iterate on weights without coordinating across files.

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { ACTIVITIES_BY_ID, type Category, type Spot } from "@/lib/types";
import { squaredDistance, type LngLat } from "@/lib/geo";

export interface SpaceFinderProps {
  /** Every spot in the city. We score the full list client-side. */
  spots: Spot[];
  /** Spot IDs already in the plan — always excluded. */
  inPlanIds: string[];
  /** Selected `Activity.id`s. */
  activities: string[];
  /** Selected vibes (from `VIBE_MOODS`). */
  vibes: string[];
  /** Selected neighborhoods. */
  neighborhoods: string[];
  /** Last added stop's coords, for the proximity bonus. */
  anchor?: LngLat | null;
  /** How many suggestions to surface (default 5). */
  topN?: number;
  /** Spot the user just clicked on the map — surfaced above the list
   *  as a quick-add card. Null when no focus. */
  focusedSpotId?: string | null;
  onClearFocused?: () => void;
  /** Add a spot to the plan. Returns true when the add succeeded
   *  (parent usually wires through `useItineraryDraft.add`). */
  onAdd: (spotId: string) => boolean;
  /** Visual nudge for when the plan is at capacity. Disables +
   *  buttons with a tooltip. */
  isFull?: boolean;
}

type Scored = { spot: Spot; score: number };

export default function SpaceFinder({
  spots,
  inPlanIds,
  activities,
  vibes,
  neighborhoods,
  anchor,
  topN = 5,
  focusedSpotId,
  onClearFocused,
  onAdd,
  isFull = false,
}: SpaceFinderProps) {
  const inPlanSet = useMemo(() => new Set(inPlanIds), [inPlanIds]);
  const hasCriteria =
    activities.length > 0 || vibes.length > 0 || neighborhoods.length > 0;

  // Scored / filtered candidates, fed by criteria.
  const ranked = useMemo<Scored[]>(() => {
    return rankCandidates(spots, {
      inPlanSet,
      activities,
      vibes,
      neighborhoods,
      anchor: anchor ?? null,
    });
  }, [spots, inPlanSet, activities, vibes, neighborhoods, anchor]);

  const focused = focusedSpotId
    ? spots.find((s) => s.id === focusedSpotId && !inPlanSet.has(s.id))
    : undefined;

  const visibleSuggestions = ranked.slice(0, topN);
  const showSuggestions = visibleSuggestions.length > 0;
  const hasAnyContent = focused || showSuggestions;

  return (
    <div className="space-y-3">
      {/* Focused (map-clicked) card */}
      {focused && (
        <div>
          <div className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
            Selected on the map
          </div>
          <SpaceCard
            spot={focused}
            onAdd={() => {
              if (onAdd(focused.id)) onClearFocused?.();
            }}
            isFull={isFull}
          />
        </div>
      )}

      {showSuggestions && (
        <div>
          <div className="mb-2">
            <div className="text-sm font-medium text-neutral-900 dark:text-white">
              {inPlanIds.length === 0 ? "Start here" : "Pairs well"}
            </div>
            {hasCriteria && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Ranked by your filters
              </p>
            )}
          </div>
          <ul className="space-y-1.5">
            {visibleSuggestions.map(({ spot }) => (
              <li key={spot.id}>
                <SpaceCard
                  spot={spot}
                  onAdd={() => onAdd(spot.id)}
                  isFull={isFull}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasAnyContent && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Pick a date, activity, or area above — matching spaces will appear
          here.
        </div>
      )}
    </div>
  );
}

/** Ranked spot list produced from the current criteria. Exported so
 *  the planner can reuse the same ordering when dimming non-matching
 *  map pins (candidate layer). */
export function rankCandidates(
  spots: Spot[],
  ctx: {
    inPlanSet: Set<string>;
    activities: string[];
    vibes: string[];
    neighborhoods: string[];
    anchor: LngLat | null;
  },
): Scored[] {
  const requiredCats = collectActivityCategories(ctx.activities);
  const activityVibes = collectActivityVibes(ctx.activities);
  const selectedVibes = new Set(ctx.vibes.map((v) => v.toLowerCase()));
  const selectedHoods = new Set(
    ctx.neighborhoods.map((n) => n.toLowerCase()),
  );

  // Normalize distance to [0, 1] across the city so the bonus weight is
  // stable regardless of how tight a city is geographically.
  let maxDist = 0;
  if (ctx.anchor) {
    for (const s of spots) {
      const d = squaredDistance(ctx.anchor, [s.lng, s.lat]);
      if (d > maxDist) maxDist = d;
    }
  }

  const out: Scored[] = [];
  for (const s of spots) {
    if (ctx.inPlanSet.has(s.id)) continue;
    // Hard filter: activity-required categories. Compare against the
    // spot's *primary* category (`category[0]`) rather than any tag in
    // the array. A cocktail bar that also serves food is tagged
    // `["drinks","dining"]`, and `some()` would admit it for "Dinner"
    // even though its primary identity is drinks. The rest of the app
    // (cards, notifications, copy) already treats `category[0]` as the
    // headline, so ranking follows the same convention.
    if (requiredCats.size) {
      const primary = s.category[0];
      if (!primary || !requiredCats.has(primary)) continue;
    }
    // Hard filter: neighborhood. "Where" is a place the user is
    // committing to — a recommendation outside their chosen area isn't
    // a useful suggestion, it's a distraction. Vibe stays a bonus
    // (it's the only dimension we soft-rank on).
    if (
      selectedHoods.size &&
      !selectedHoods.has(s.neighborhood.toLowerCase())
    ) {
      continue;
    }

    let score = 0;
    const sVibes = (s.vibes ?? []).map((v) => v.toLowerCase());
    for (const v of sVibes) {
      if (selectedVibes.has(v)) score += 2;
      if (activityVibes.has(v)) score += 1;
    }
    if (ctx.anchor && maxDist > 0) {
      const d = squaredDistance(ctx.anchor, [s.lng, s.lat]);
      // Inverse-normalized: nearest = +1, farthest ≈ 0.
      score += 1 - d / maxDist;
    }
    out.push({ spot: s, score });
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable-ish tiebreak by name — avoids the ranking shuffling on
    // criteria changes that don't affect the top scorer.
    return a.spot.name.localeCompare(b.spot.name);
  });
  return out;
}

function collectActivityCategories(ids: string[]): Set<Category> {
  const out = new Set<Category>();
  for (const id of ids) {
    const a = ACTIVITIES_BY_ID[id];
    if (!a) continue;
    for (const c of a.categories) out.add(c);
  }
  return out;
}

function collectActivityVibes(ids: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const a = ACTIVITIES_BY_ID[id];
    if (!a) continue;
    for (const v of a.vibes) out.add(v.toLowerCase());
  }
  return out;
}

function SpaceCard({
  spot,
  onAdd,
  isFull,
}: {
  spot: Spot;
  onAdd: () => void;
  isFull: boolean;
}) {
  const thumb = spot.images?.[0];
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="w-11 h-11 rounded-lg object-cover shrink-0 bg-neutral-100 dark:bg-neutral-800"
        />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{spot.name}</div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {spot.neighborhood}
          {spot.subcategory?.[0] ? ` · ${spot.subcategory[0]}` : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={isFull}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Add ${spot.name}`}
        title={isFull ? "Plan is full" : `Add ${spot.name}`}
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
