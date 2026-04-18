"use client";

// Editable itinerary planner (v1 — the active UX).
//
// Shape of the page:
//   ┌────────────────────────────┬──────────────────┐
//   │ Name input                 │                  │
//   │ Stop count · caption       │                  │
//   ├────────────────────────────┤                  │
//   │ 1 ⋮⋮ Gekko       7:30 PM × │                  │
//   │ 2 ⋮⋮ Delilah     9:00 PM × │      Map         │
//   │ (drag to reorder)          │                  │
//   │                            │                  │
//   │ [+ Browse spaces]          │                  │
//   ├────────────────────────────┤                  │
//   │ [Share link]  [Save plan]  │                  │
//   └────────────────────────────┴──────────────────┘
//
// No criteria row, no SpaceFinder, no BottomSheet — those belong to v2
// which lives alongside this file (see `ItineraryPlannerV2.tsx`). V1's
// planning workflow expects the user to find spaces on the city grid
// and click each card's circle-plus icon; the planner is purely the
// commit / reorder / time-assign / save / share surface.
//
// Shared components with v2: `StopRow` (single stop row with dnd-kit
// handle + time input + reserve link) and `ItineraryMap` (numbered
// pins + route). Both accept v2-only props (candidate/suggestion
// layers on the map) but V1 simply doesn't pass them.
//
// Persistence: when `persistAsDraft` is true, edits mirror into the
// per-city localStorage draft via `useItineraryDraft` so a reload
// preserves work. When editing a saved row, that flag is false and
// edits stay local until Save.
//
// Save writes to the DB and (for draft mode) clears the draft on
// success. Share serializes the current state to a URL and copies it
// via the clipboard API.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ITINERARY_MAX_STOPS, type Spot } from "@/lib/types";
import { buildShareUrl, parseTimeInputValue } from "@/lib/itinerary-url";
import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import { saveItinerary, deleteItinerary } from "@/app/actions/itineraries";
import ItineraryMap, { type ItineraryMapStop } from "./ItineraryMap";
import StopRow from "./StopRow";

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
  const [hoverSpotId, setHoverSpotId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; id: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  // Brief "Saved" confirmation after a successful save — auto-reverts
  // so the button can return to "Update" for subsequent edits.
  const [justSaved, setJustSaved] = useState(false);

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
  const initialKeyRef = useRef<string>("");
  const initialKey = `${savedId ?? "draft"}:${initial.items.length}:${initial.name}`;
  useEffect(() => {
    if (initialKeyRef.current === initialKey) return;
    initialKeyRef.current = initialKey;
    setName(initial.name);
    setItems(initial.items);
  }, [initialKey, initial.name, initial.items]);

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
    // Setters are stable useCallback refs; listing `draft` would cause
    // the effect to re-run for every snapshot update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, name, persistAsDraft]);

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

  const setTime = useCallback((spotId: string, value: string) => {
    const hhmm = parseTimeInputValue(value);
    setItems((prev) =>
      prev.map((it) =>
        it.spotId === spotId ? { ...it, timeLabel: hhmm } : it,
      ),
    );
  }, []);

  const stopCount = visibleItems.length;
  const canAddMore = stopCount < ITINERARY_MAX_STOPS;

  // Map stops are derived directly from state so reorder triggers a
  // cheap position re-number (no marker recreation).
  const mapStops: ItineraryMapStop[] = useMemo(() => {
    return visibleItems.map((it, i) => {
      const s = spotById.get(it.spotId)!;
      return {
        spotId: s.id,
        name: s.name,
        lng: s.lng,
        lat: s.lat,
        position: i,
      };
    });
  }, [visibleItems, spotById]);

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
    });
    if (res.success) {
      setSaveState({ kind: "saved", id: res.id });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
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

  return (
    <div className="h-full flex flex-col split:flex-row">
      {/* Left column: the plan. On narrow viewports this takes the full
          width and the map is pushed below. On split view (≥896px) it
          sits at a fixed 45% width beside the map. */}
      <div className="w-full split:w-[45%] lg:w-[40%] split:min-w-[380px] split:shrink-0 flex flex-col overflow-hidden">
        {/* Header: name + stop count. */}
        <div className="px-4 md:px-6 pt-4 pb-3 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-surface">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Saturday night in ${cityName}`}
            maxLength={60}
            className="w-full bg-transparent text-xl md:text-2xl font-medium placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none"
            aria-label="Plan name"
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {stopCount === 0
              ? `Pick the spaces that'll make your night in ${cityName}.`
              : !canAddMore
                ? `Plan is full — ${ITINERARY_MAX_STOPS} spaces max.`
                : stopCount === 1
                  ? `1 space in your plan. Drag to reorder, set times below.`
                  : `${stopCount} spaces in your plan. Drag to reorder, set times below.`}
          </p>
        </div>

        {/* Stops list (dnd-kit) + add-a-space CTA. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 md:px-6 py-3 space-y-3">
            {visibleItems.length > 0 ? (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={visibleItems.map((it) => it.spotId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-2">
                      {visibleItems.map((it, i) => {
                        const spot = spotById.get(it.spotId)!;
                        return (
                          <StopRow
                            key={it.spotId}
                            spot={spot}
                            position={i}
                            timeLabel={it.timeLabel}
                            onRemove={() => removeItem(it.spotId)}
                            onTimeChange={(v) => setTime(it.spotId, v)}
                            onHover={(hover) =>
                              setHoverSpotId(hover ? it.spotId : null)
                            }
                          />
                        );
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>

                {/* End-of-list CTA — dashed rectangle that reads as a
                    natural continuation of the stop rows. When the plan
                    is full we swap it for a muted notice instead. */}
                {canAddMore ? (
                  <Link
                    href={`/${citySlug}`}
                    className="flex items-center justify-center px-4 py-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-500 dark:hover:border-neutral-500 transition-colors"
                  >
                    Add a space from {cityName}
                  </Link>
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    Plan is full — remove a space to add another.
                  </div>
                )}
              </>
            ) : (
              <EmptyList citySlug={citySlug} cityName={cityName} />
            )}
          </div>
        </div>

        {/* Action bar: Share (always) + Save / Update (signed in) +
            Delete (saved plans only). Per button rule, labels are
            text-only; the delete button is the one exception as an
            icon-only control. */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-surface px-4 md:px-6 py-3 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCopyShare}
            disabled={stopCount === 0}
            aria-label="Copy share link"
          >
            {copied ? "Link copied" : "Share link"}
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
                : justSaved
                  ? "Saved"
                  : savedId
                    ? "Update"
                    : "Save plan"}
            </Button>
          )}
          {savedId && canSave && (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleDelete}
              className="ml-auto"
              aria-label="Delete plan"
            >
              <Trash2 size={14} />
            </Button>
          )}
          {saveState.kind === "error" && (
            <span className="text-xs text-red-600">{saveState.message}</span>
          )}
        </div>
      </div>

      {/* Right column: map. On mobile it drops below the panel as a
          fixed-height band so the user can still see their route
          without leaving the page. */}
      <div className="h-[40vh] split:h-auto split:flex-1 min-h-0 relative px-4 pb-4 split:pt-1.5">
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
          <ItineraryMap
            stops={mapStops}
            highlightSpotId={hoverSpotId}
            onPinClick={(id) => setHoverSpotId(id)}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyList({
  citySlug,
  cityName,
}: {
  citySlug: string;
  cityName: string;
}) {
  // Centered empty state matching the pattern used elsewhere in the app
  // (Favorites / Check-ins / Wishlist). The icon is purely decorative —
  // the rule that forbids icons-in-buttons doesn't apply to inline
  // illustrations like this one.
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5 bg-ink-100">
        <Sparkles
          size={22}
          strokeWidth={1.5}
          className="text-neutral-500 dark:text-neutral-400"
        />
      </div>
      <h3 className="text-base font-medium">Build your night out</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs">
        Add up to {ITINERARY_MAX_STOPS} spaces in order — dinner, drinks,
        wherever you&rsquo;re ending up — and we&rsquo;ll map your route.
      </p>
      <Link
        href={`/${citySlug}`}
        className="inline-flex items-center justify-center mt-6 px-4 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
      >
        Browse {cityName} spaces
      </Link>
    </div>
  );
}
