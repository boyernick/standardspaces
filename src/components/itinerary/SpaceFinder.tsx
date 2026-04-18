"use client";

// "Pairs well" + inline search block. Combines three surfaces into a
// single component because they share the same underlying candidate
// ranking and the same card UI:
//
//   1. A ranked list of 3–5 suggestions based on the planner's criteria
//      and (if ≥1 stop is added) the last stop's coordinates.
//   2. A free-text search input (client-side, against the full city
//      `spots` list) so the user can find a specific space that didn't
//      surface in the ranked list.
//   3. A direct-add card when the planner signals the user clicked a
//      candidate pin on the map (via `focusedSpotId`).
//
// Scoring lives entirely here. The caller passes the full spot list for
// the city plus the current criteria + stops, and we produce a ranked
// list. Keeping the scorer co-located with its callers means we can
// iterate on weights without coordinating across files.

import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inPlanSet = useMemo(() => new Set(inPlanIds), [inPlanIds]);

  // Scored / filtered candidates, fed by criteria. Memoized so we don't
  // re-score on every keystroke in the search box (the search derives
  // its own filter on top).
  const ranked = useMemo<Scored[]>(() => {
    return rankCandidates(spots, {
      inPlanSet,
      activities,
      vibes,
      neighborhoods,
      anchor: anchor ?? null,
    });
  }, [spots, inPlanSet, activities, vibes, neighborhoods, anchor]);

  // Search results — local substring match on name / neighborhood /
  // subcategory so typos ("gekko" / "Gekko" / "miami") all hit. We
  // exclude already-added spots and respect the criteria's *required*
  // activity filter (so searching "coffee" while "Dinner" is selected
  // still filters to dining spots — avoids contradictory results).
  const searchResults = useMemo<Spot[]>(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const requiredCats = collectActivityCategories(activities);
    return spots
      .filter((s) => !inPlanSet.has(s.id))
      .filter((s) =>
        requiredCats.size
          ? s.category.some((c) => requiredCats.has(c))
          : true,
      )
      .filter((s) => {
        const blob = [
          s.name,
          s.neighborhood,
          ...(s.subcategory ?? []),
          ...(s.vibes ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 12);
  }, [spots, inPlanSet, deferredQuery, activities]);

  const focused = focusedSpotId
    ? spots.find((s) => s.id === focusedSpotId && !inPlanSet.has(s.id))
    : undefined;

  const visibleSuggestions = ranked.slice(0, topN);
  const showSuggestions = visibleSuggestions.length > 0 && !deferredQuery.trim();
  const hasAnyContent =
    focused ||
    showSuggestions ||
    searchResults.length > 0 ||
    deferredQuery.trim();

  return (
    <div className="space-y-3">
      {/* Search */}
      <label className="block relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search spaces"
          className="w-full bg-surface border border-neutral-200 dark:border-neutral-800 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
        />
      </label>

      {/* Focused (map-clicked) card */}
      {focused && (
        <div>
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
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

      {/* Search results override suggestions when a query is present */}
      {deferredQuery.trim() ? (
        <div>
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            {searchResults.length === 0
              ? `No matches for "${deferredQuery}"`
              : `${searchResults.length} ${searchResults.length === 1 ? "match" : "matches"}`}
          </div>
          <ul className="space-y-1.5">
            {searchResults.map((s) => (
              <li key={s.id}>
                <SpaceCard spot={s} onAdd={() => onAdd(s.id)} isFull={isFull} />
              </li>
            ))}
          </ul>
        </div>
      ) : showSuggestions ? (
        <div>
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            {inPlanIds.length === 0 ? "Start here" : "Pairs well"}
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
      ) : null}

      {!hasAnyContent && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Pick a date, activity, or vibe above — matching spaces will appear
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
    // Hard filter: activity-required categories.
    if (requiredCats.size && !s.category.some((c) => requiredCats.has(c))) {
      continue;
    }

    let score = 0;
    const sVibes = (s.vibes ?? []).map((v) => v.toLowerCase());
    for (const v of sVibes) {
      if (selectedVibes.has(v)) score += 2;
      if (activityVibes.has(v)) score += 1;
    }
    if (selectedHoods.size && selectedHoods.has(s.neighborhood.toLowerCase())) {
      score += 1;
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
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-brand-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Add ${spot.name}`}
        title={isFull ? "Plan is full" : `Add ${spot.name}`}
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
