"use client";

// Editable itinerary planner. Top of the side panel is the criteria
// row (date, activity, vibe, neighborhood). Below that, the ordered,
// drag-reorderable stops list. Below the stops, the `SpaceFinder`
// search + "Pairs well" suggestions. The map at right renders
// committed stops as numbered pins, plus a candidate dot layer and
// suggestion pulse layer driven by the same criteria.
//
// The plan name is not user-editable in the UI — we carry it in state
// so a saved plan loaded from the DB keeps its existing name, and new
// plans fall back to "Untitled plan" on save. Removing the field from
// the form meant fewer decisions to make before building the plan.
//
// State model: the planner owns `name`, `items`, and the four criteria
// fields in local React state. When `persistAsDraft` is true (the
// default for /[city]/itinerary), it mirrors every change into the
// localStorage draft via the hook, so a reload preserves the work.
// When editing a saved itinerary, the caller passes
// `persistAsDraft=false`; local edits don't leak into the draft.
//
// Save writes to the DB and (for draft mode) clears the draft on
// success. Share serializes the current state (including criteria) to
// a URL and copies it via the browser's clipboard API.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ACTIVITIES_BY_ID,
  ITINERARY_MAX_STOPS,
  type Category,
  type Spot,
} from "@/lib/types";
import type { LngLatBounds } from "@/lib/geo";
import { buildShareUrl } from "@/lib/itinerary-url";
import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import {
  saveItinerary,
  deleteItinerary,
} from "@/app/actions/itineraries";
import SpotMap from "@/components/Map";
import CriteriaRow from "./CriteriaRow";
import StopRow from "./StopRow";
import SpaceFinder from "./SpaceFinder";
import BottomSheet, { type BottomSheetSnap } from "./BottomSheet";

/** Matches the Tailwind `split:` breakpoint (56rem ≈ 896px). Used to
 *  decide between the desktop two-column layout and the mobile
 *  map-underneath, bottom-sheet-over-the-top layout. */
const SPLIT_BREAKPOINT_PX = 896;

/** Subscribe to the split breakpoint via `matchMedia`. useSyncExternalStore
 *  is the React 19 idiom for external subscriptions — it avoids the
 *  "setState synchronously in effect" anti-pattern the linter flags for
 *  the older useEffect + setState approach, and it returns a consistent
 *  value on the same render (no flash between SSR and hydration). */
function subscribeSplit(onChange: () => void): () => void {
  const mql = window.matchMedia(`(min-width: ${SPLIT_BREAKPOINT_PX}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
function getSplitSnapshot(): boolean {
  return window.matchMedia(`(min-width: ${SPLIT_BREAKPOINT_PX}px)`).matches;
}
function getSplitServerSnapshot(): boolean {
  return true; // SSR default: desktop layout. Hydration corrects on mount.
}
function useIsSplitLayout(): boolean {
  return useSyncExternalStore(
    subscribeSplit,
    getSplitSnapshot,
    getSplitServerSnapshot,
  );
}

type Item = { spotId: string; timeLabel: string | null };

export interface ItineraryPlannerProps {
  citySlug: string;
  cityName: string;
  /** Spots available for lookup — typically every spot in the city, so we
   *  can render thumbnails + coords without a round-trip. */
  spots: Spot[];
  /** Starting state. For draft mode this comes from the hook; for a
   *  saved itinerary it comes from `getItinerary`. */
  initial: {
    name: string;
    items: Item[];
    date?: string | null;
    activities?: string[];
    vibes?: string[];
    neighborhoods?: string[];
  };
  /** If present, Save updates this row. If absent, Save inserts a new row. */
  savedId?: string;
  /** Whether the signed-in user can save. Share is always available. */
  canSave: boolean;
  /** Sync edits back into the localStorage draft. */
  persistAsDraft: boolean;
}

export default function ItineraryPlanner({
  citySlug,
  cityName,
  spots,
  initial,
  savedId,
  canSave,
  persistAsDraft,
}: ItineraryPlannerProps) {
  const router = useRouter();
  const draft = useItineraryDraft(citySlug);

  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<Item[]>(initial.items);
  const [date, setDate] = useState<string | null>(initial.date ?? null);
  const [activities, setActivities] = useState<string[]>(
    initial.activities ?? [],
  );
  const [vibes, setVibes] = useState<string[]>(initial.vibes ?? []);
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    initial.neighborhoods ?? [],
  );
  const [hoverSpotId, setHoverSpotId] = useState<string | null>(null);
  const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(
    null,
  );
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; id: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  // Spot lookup by id — stable across renders unless the spots array changes.
  const spotById = useMemo(() => {
    const m = new Map<string, Spot>();
    for (const s of spots) m.set(s.id, s);
    return m;
  }, [spots]);

  // Filter out items whose spot isn't in this city's list (e.g. a stale
  // localStorage draft referencing a deleted/rekeyed spot). We do this
  // on render so the canonical `items` state matches what the user sees.
  const visibleItems = useMemo(
    () => items.filter((it) => spotById.has(it.spotId)),
    [items, spotById],
  );

  // Drift guard: if `initial` changes (e.g. the URL id changes), re-seed.
  // Use a value key that captures everything we want to react to; changing
  // savedId/items length/name is enough for the saved-plan tab → tab case.
  const initialKeyRef = useRef<string>("");
  const initialKey = `${savedId ?? "draft"}:${initial.items.length}:${initial.name}`;
  useEffect(() => {
    if (initialKeyRef.current === initialKey) return;
    initialKeyRef.current = initialKey;
    setName(initial.name);
    setItems(initial.items);
    setDate(initial.date ?? null);
    setActivities(initial.activities ?? []);
    setVibes(initial.vibes ?? []);
    setNeighborhoods(initial.neighborhoods ?? []);
  }, [
    initialKey,
    initial.name,
    initial.items,
    initial.date,
    initial.activities,
    initial.vibes,
    initial.neighborhoods,
  ]);

  // Persist edits into the localStorage draft when in draft mode.
  useEffect(() => {
    if (!persistAsDraft) return;
    draft.setItems(
      items.map((it) => ({
        spotId: it.spotId,
        timeLabel: it.timeLabel ?? undefined,
      })),
    );
    draft.setName(name);
    draft.setDate(date);
    draft.setActivities(activities);
    draft.setVibes(vibes);
    draft.setNeighborhoods(neighborhoods);
    // Setters are stable useCallback refs; listing `draft` would cause
    // the effect to re-run for every snapshot update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, name, date, activities, vibes, neighborhoods, persistAsDraft]);

  // "Saved" is a transient state — flash the confirmation, then revert
  // to idle so a subsequent edit shows "Update" again rather than
  // staying stuck on the success label.
  useEffect(() => {
    if (saveState.kind !== "saved") return;
    const t = setTimeout(() => setSaveState({ kind: "idle" }), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  // dnd-kit sensors: pointer + keyboard. 6px activation distance so a
  // tap on the remove button inside the row doesn't accidentally start
  // a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.spotId === active.id);
      const newIndex = prev.findIndex((it) => it.spotId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const removeItem = useCallback((spotId: string) => {
    setItems((prev) => prev.filter((it) => it.spotId !== spotId));
  }, []);

  const stopCount = visibleItems.length;
  const canAddMore = stopCount < ITINERARY_MAX_STOPS;

  /** Add a spot to the plan. Returns true on success, false at capacity.
   *  Mirrors the shape `SpaceFinder` expects. */
  const addSpot = useCallback(
    (spotId: string): boolean => {
      let added = false;
      setItems((prev) => {
        if (prev.some((it) => it.spotId === spotId)) {
          added = true;
          return prev;
        }
        if (prev.length >= ITINERARY_MAX_STOPS) {
          added = false;
          return prev;
        }
        added = true;
        return [...prev, { spotId, timeLabel: null }];
      });
      return added;
    },
    [],
  );

  // Ordered plan stop ids — drives SpaceFinder's exclusion set, the
  // numbered corner pins on SpotMap cards, and the dashed route line
  // between stops. Reordering updates numbers in place (no marker
  // teardown) via SpotMap's plan-pin sync effect.
  const planStopIds = useMemo(
    () => visibleItems.map((it) => it.spotId),
    [visibleItems],
  );

  // Neighborhood options derived from the city's spot list.
  const neighborhoodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of spots) {
      if (s.neighborhood) set.add(s.neighborhood);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [spots]);

  // Last-added stop's coords — SpaceFinder uses this as the proximity
  // anchor for its "pairs well" ranking.
  const anchor: [number, number] | null = useMemo(() => {
    const last = visibleItems[visibleItems.length - 1];
    if (!last) return null;
    const s = spotById.get(last.spotId);
    return s ? [s.lng, s.lat] : null;
  }, [visibleItems, spotById]);

  // Bounds that cover every spot matching the current activity
  // categories ∩ neighborhoods. When the user sets or changes either,
  // this tuple identity changes and SpotMap's `focusBounds` effect
  // re-fits to the region — a neighborhood filter behaves like "pan to
  // Wynwood" without us hiding non-matching markers from the map.
  //
  // When no criteria are set we return null so the map's normal
  // initial-fit / user-location logic wins. When criteria are set but
  // no spots match, we also return null — re-fitting to an empty box
  // would be jarring and `rankCandidates` will already be empty.
  const focusBounds: LngLatBounds | null = useMemo(() => {
    if (activities.length === 0 && neighborhoods.length === 0) return null;

    const requiredCats = new Set<Category>();
    for (const id of activities) {
      const a = ACTIVITIES_BY_ID[id];
      if (!a) continue;
      for (const c of a.categories) requiredCats.add(c);
    }
    const selectedHoods = new Set(neighborhoods.map((n) => n.toLowerCase()));

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    let count = 0;
    for (const s of spots) {
      // Match SpaceFinder: primary-category match only, so the map's
      // fit-to-region mirrors the list of spots that actually surface
      // as recommendations below.
      if (requiredCats.size) {
        const primary = s.category[0];
        if (!primary || !requiredCats.has(primary)) continue;
      }
      if (
        selectedHoods.size &&
        !selectedHoods.has(s.neighborhood.toLowerCase())
      ) {
        continue;
      }
      if (s.lng < minLng) minLng = s.lng;
      if (s.lng > maxLng) maxLng = s.lng;
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      count++;
    }
    if (count === 0) return null;
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  }, [spots, activities, neighborhoods]);

  async function handleSave() {
    if (!canSave || visibleItems.length === 0) return;
    setSaveState({ kind: "saving" });
    const res = await saveItinerary({
      id: savedId,
      city: cityName,
      name: name.trim() || "Untitled plan",
      items: visibleItems.map((it) => ({
        spotId: it.spotId,
        timeLabel: it.timeLabel,
      })),
      date,
      activities,
      vibes,
      neighborhoods,
    });
    if (res.success) {
      setSaveState({ kind: "saved", id: res.id });
      if (persistAsDraft) draft.clear();
      // Navigate to the canonical saved URL. Replace (not push) so the
      // back button doesn't bounce through /itinerary → /itinerary/:id.
      if (!savedId) {
        router.replace(`/${citySlug}/itinerary/${res.id}`);
      }
    } else {
      const msg =
        res.error === "too_many_stops"
          ? `Maximum ${ITINERARY_MAX_STOPS} stops per plan.`
          : res.error === "unauthenticated"
            ? "Sign in to save your plan."
            : res.error === "empty"
              ? "Add at least one space before saving."
              : "Couldn't save — try again.";
      setSaveState({ kind: "error", message: msg });
    }
  }

  async function handleDelete() {
    if (!savedId) return;
    if (!confirm("Delete this plan? This can't be undone.")) return;
    await deleteItinerary(savedId);
    router.replace(`/${citySlug}`);
  }

  async function handleCopyShare() {
    if (typeof window === "undefined") return;
    const url = buildShareUrl(window.location.origin, citySlug, {
      items: visibleItems.map((it) => ({
        spotId: it.spotId,
        timeLabel: it.timeLabel ?? undefined,
      })),
      name: name.trim() || undefined,
      date,
      activities,
      vibes,
      neighborhoods,
    });
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isSplit = useIsSplitLayout();
  const [sheetSnap, setSheetSnap] = useState<BottomSheetSnap>("half");

  // When the user taps a map dot on mobile, bump the sheet to "half" so
  // the focused card is visible without burying the map. Desktop is a
  // no-op (the focused card appears inline in the fixed panel).
  useEffect(() => {
    if (isSplit) return;
    if (!focusedCandidateId) return;
    if (sheetSnap === "peek") setSheetSnap("half");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCandidateId, isSplit]);

  // Shared blocks — rendered inside the desktop split column *or* the
  // mobile bottom sheet. We factor them into JSX variables rather than
  // sub-components so state access stays direct (no prop ferrying).

  const header = (
    <div className="px-4 md:px-6 pt-4 pb-3 space-y-3 bg-surface">
      <CriteriaRow
        date={date}
        onDateChange={setDate}
        activities={activities}
        onActivitiesChange={setActivities}
        neighborhoodOptions={neighborhoodOptions}
        neighborhoods={neighborhoods}
        onNeighborhoodsChange={setNeighborhoods}
      />
    </div>
  );

  const body = (
    <div className="px-4 md:px-6 py-4 space-y-6">
      {visibleItems.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={visibleItems.map((it) => it.spotId)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {visibleItems.map((it, i) => {
                const spot = spotById.get(it.spotId)!;
                return (
                  <StopRow
                    key={it.spotId}
                    spot={spot}
                    position={i}
                    onRemove={() => removeItem(it.spotId)}
                    onHover={(hover) =>
                      setHoverSpotId(hover ? it.spotId : null)
                    }
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <SpaceFinder
        spots={spots}
        inPlanIds={planStopIds}
        activities={activities}
        vibes={vibes}
        neighborhoods={neighborhoods}
        anchor={anchor}
        focusedSpotId={focusedCandidateId}
        onClearFocused={() => setFocusedCandidateId(null)}
        onAdd={addSpot}
        isFull={!canAddMore}
      />
    </div>
  );

  const actionBar = (
    // Buttons float right; the destructive Delete gets `mr-auto` so it
    // stays pinned to the far left (where destructive actions read as
    // separate from the primary-action cluster). The error span, when
    // present, sits directly left of the Share/Save pair.
    <div className="bg-surface px-4 md:px-6 py-3 flex items-center gap-2 justify-end">
      {savedId && canSave && (
        <Button
          type="button"
          variant="danger"
          size="md"
          onClick={handleDelete}
          className="mr-auto"
          aria-label="Delete plan"
        >
          <Trash2 size={14} />
        </Button>
      )}
      {saveState.kind === "error" && (
        <span className="text-xs text-red-600">{saveState.message}</span>
      )}
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={handleCopyShare}
        disabled={stopCount === 0}
        aria-label="Copy share link"
      >
        {copied ? "Copied" : "Share link"}
      </Button>
      {canSave && (
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={stopCount === 0 || saveState.kind === "saving"}
        >
          {saveState.kind === "saving"
            ? "Saving…"
            : saveState.kind === "saved"
              ? "Saved"
              : savedId
                ? "Update"
                : "Save plan"}
        </Button>
      )}
    </div>
  );

  // Map surface — reuses the city-page SpotMap so dot/card mode, plan
  // corner pins, and the active-spot ring all behave identically to the
  // main discovery surface. `planStopIds` + `showPlanRoute` wire in the
  // dashed route between stops; `activeSpot` drives the emphasized card.
  const focusedSpot = focusedCandidateId
    ? (spotById.get(focusedCandidateId) ?? null)
    : null;
  const mapNode = (
    <SpotMap
      spots={spots}
      activeSpot={focusedSpot}
      onSpotSelect={(s) => setFocusedCandidateId(s?.id ?? null)}
      hoverSpotId={hoverSpotId}
      planStopIds={planStopIds}
      showPlanRoute
      focusBounds={focusBounds}
    />
  );

  if (isSplit) {
    return (
      <div className="h-full flex flex-row">
        {/* Left column: panel */}
        <div className="w-[45%] lg:w-[40%] min-w-[380px] shrink-0 flex flex-col overflow-hidden">
          <div className="shrink-0">{header}</div>
          <div className="flex-1 min-h-0 overflow-y-auto">{body}</div>
          <div className="shrink-0">{actionBar}</div>
        </div>

        {/* Right column: map — matches the city page's bordered, padded
            map well (px-4 pt-1.5 pb-4 outer, rounded-2xl inner). */}
        <div className="flex-1 min-h-0 relative px-4 pb-4 pt-1.5">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
            {mapNode}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: map fills the viewport; bottom sheet slides over. Three
  // snap points: peek (header only), half (header + stops), full
  // (everything including SpaceFinder suggestions).
  return (
    <div className="h-full w-full relative overflow-hidden">
      <div className="absolute inset-0 px-3 pb-3 pt-1.5">
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
          {mapNode}
        </div>
      </div>
      <BottomSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        ariaLabel="Itinerary plan"
        header={header}
      >
        <div className="flex flex-col">
          {body}
          {actionBar}
        </div>
      </BottomSheet>
    </div>
  );
}

