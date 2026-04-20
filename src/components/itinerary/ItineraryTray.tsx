"use client";

// Sticky bottom tray that surfaces the current draft itinerary on the
// city page. Appears when the draft has at least one space. Two states:
//
// - Collapsed (default): a compact pill — avatar stack, "N spaces in the
//   plan," and a clear action.
// - Expanded: the same pill morphs into a surface-matched card with the
//   full stops list (thumbnail + name + neighborhood + time + remove),
//   a "Clear plan" footer link, and an "Open planner" CTA that routes to
//   the saved-plan editor for date, invites, and reorder.
//
// Expansion is local — the tray stays mounted on the city page; tapping
// the pill never routes. Saving the draft to a persisted plan lives on
// the saved-plan editor now; the tray is pure peek-and-prune.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, GripVertical, ListOrdered, X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useItineraryDraft } from "@/hooks/useItineraryDraft";
import { cityNameFromSlug, citySlugFromName } from "@/lib/cities";
import { formatTime } from "@/lib/itinerary-url";
import { ITINERARY_MAX_STOPS, type Spot } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { saveItinerary } from "@/app/actions/itineraries";

// Same inset from viewport bottom as the map view's bottom controls (and
// the mobile bottom bar on CityClient). Callers can override via
// `bottomOffset`, but the default keeps the tray anchored consistently
// across pages so it doesn't drift between surfaces.
const DEFAULT_BOTTOM_OFFSET = 16;

type PlanStop = { spot: Spot; timeLabel: string | null };

export default function ItineraryTray({
  citySlug,
  spots,
  /** Extra bottom offset (px) added on top of the default. Callers like
   *  CityClient pass this to clear their mobile bottom bar. */
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
}: {
  citySlug: string;
  spots: Spot[];
  bottomOffset?: number;
}) {
  const router = useRouter();
  const { draft, clear, remove, setItems } = useItineraryDraft(citySlug);
  const [expanded, setExpanded] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  // Resolve the Spot records for each draft item so we can render their
  // images + names + times. Missing spots (e.g. a stale draft referring
  // to a deleted listing) are silently dropped.
  const planStops = useMemo<PlanStop[]>(
    () =>
      draft.items
        .map((it) => {
          const spot = spots.find((s) => s.id === it.spotId);
          return spot ? { spot, timeLabel: it.timeLabel ?? null } : null;
        })
        .filter((v): v is PlanStop => !!v),
    [draft.items, spots],
  );

  // Cap the avatar stack at three circles — the pill's label is just the
  // stop count now, so the avatars are the only visual summary of which
  // spaces are in the plan; more than three would just add width.
  const visibleStops = planStops.slice(0, 3);

  const count = draft.items.length;
  const show = count > 0;

  // Collapse on Escape when expanded — the natural "close this panel"
  // gesture and required for any dialog-ish affordance.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Clear + reset-expanded paths: any time the draft empties, the tray
  // should collapse so a fresh future draft starts in the pill state.
  // We thread this through both the explicit clear action and the
  // "remove last stop" path rather than using a separate effect, so the
  // reset happens alongside the mutation that caused it.
  const clearAndCollapse = useCallback(() => {
    clear();
    setExpanded(false);
  }, [clear]);

  const removeAndMaybeCollapse = useCallback(
    (spotId: string) => {
      remove(spotId);
      if (count <= 1) setExpanded(false);
    },
    [remove, count],
  );

  // Persist the draft to a real itinerary row and jump into the
  // saved-plan editor. Opening the planner is the only way to turn a
  // draft into a stored plan now — the polish surface is where dates,
  // invites, and reorder live. On success we clear the local draft so
  // the tray exits cleanly behind the navigation.
  const handleOpenPlanner = useCallback(async () => {
    if (opening || draft.items.length === 0) return;
    setOpening(true);
    setOpenError(null);
    const cityName = cityNameFromSlug(citySlug) ?? citySlug;
    const res = await saveItinerary({
      city: cityName,
      name: draft.name?.trim() || "Untitled plan",
      items: draft.items.map((it) => ({
        spotId: it.spotId,
        timeLabel: it.timeLabel ?? null,
      })),
      date: draft.date,
      activities: draft.activities,
      vibes: draft.vibes,
      neighborhoods: draft.neighborhoods,
    });
    if (!res.success) {
      const msg =
        res.error === "too_many_stops"
          ? `Maximum ${ITINERARY_MAX_STOPS} spaces per plan.`
          : res.error === "unauthenticated"
            ? "Sign in to open the planner."
            : res.error === "empty"
              ? "Add at least one space before opening."
              : "Couldn't open the planner — try again.";
      setOpenError(msg);
      setOpening(false);
      return;
    }
    clear();
    setExpanded(false);
    router.push(`/${citySlug}/itinerary/${res.id}`);
  }, [
    opening,
    draft.items,
    draft.name,
    draft.date,
    draft.activities,
    draft.vibes,
    draft.neighborhoods,
    citySlug,
    clear,
    router,
  ]);

  // Auto-clear the open-planner error when the draft changes — any edit
  // is an implicit retry intent.
  useEffect(() => {
    if (!openError) return;
    setOpenError(null);
  }, [draft.items.length, openError]);

  // Reorder via dnd-kit. The hook's `setItems` is a wholesale replacement
  // and reads the freshest draft internally before writing, so there's no
  // race with concurrent tabs — we just need to hand it the right slice.
  const reorderStops = useCallback(
    (activeId: string, overId: string) => {
      const current = draft.items;
      const oldIndex = current.findIndex((it) => it.spotId === activeId);
      const newIndex = current.findIndex((it) => it.spotId === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      setItems(arrayMove(current, oldIndex, newIndex));
    },
    [draft.items, setItems],
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="itinerary-tray"
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0 }}
          // Spring on Y for a natural settle (no overshoot — ζ > 1), plus
          // a crisp opacity fade so the tray doesn't feel like it's
          // "floating in" while invisible. Shorter travel (48 vs 80px)
          // reads as a lighter introduction.
          transition={{
            y: { type: "spring", stiffness: 320, damping: 34, mass: 0.85 },
            opacity: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
          }}
          // Below the split breakpoint, use the caller-provided offset
          // (CityClient passes 72 to clear its mobile search/toggle bar).
          // At split+ there's no mobile bottom bar, so pin the tray close
          // to the viewport bottom — matching the map view's 16px inset.
          // Both values add safe-area-inset-bottom so the tray clears the
          // iOS home indicator.
          style={{ "--tray-bottom": `${bottomOffset}px` } as React.CSSProperties}
          className="fixed left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none bottom-[calc(var(--tray-bottom)+env(safe-area-inset-bottom,0px))] split:bottom-[calc(16px+env(safe-area-inset-bottom,0px))]"
        >
          <div
            className={`mx-auto pointer-events-auto ${
              expanded ? "max-w-md" : "max-w-sm"
            }`}
          >
            {/* Shared container morphs between pill and card. `layout`
             *  on this motion.div handles the width/height animation
             *  continuously, while the animated `borderRadius` reshapes
             *  from a full pill (9999) to a rounded card (24) in one
             *  smooth pass. Inner `AnimatePresence` with mode="popLayout"
             *  crossfades the contents without blocking the morph: the
             *  exiting variant drops to `position: absolute` so the
             *  container size is driven entirely by the entering one.
             */}
            <motion.div
              layout
              initial={false}
              animate={{ borderRadius: expanded ? 24 : 9999 }}
              // Duration-based ease rather than a spring: we want a
              // predictable, symmetric feel in both directions with a
              // clean endpoint. A spring's long settle tail makes the
              // collapse read as "already there but still moving" and
              // the expand read as "drawn out" — both failure modes.
              // `[0.32, 0.72, 0, 1]` is an emphasized decelerate curve
              // (quick start, soft landing) that feels right for a
              // shape-morph at this scale.
              transition={{
                layout: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
                borderRadius: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
              }}
              className="bg-surface border border-neutral-200 dark:border-neutral-800 shadow-[0_16px_40px_rgba(0,0,0,0.35)] overflow-hidden"
            >
              {/* Content swap timing is tuned for the open direction
                  (the harder one). Closing works fine with almost any
                  timing because the incoming pill is small and the
                  container shrinks "around" the new content. Opening
                  is the visually tricky case: if the new content waits
                  for the old to fully exit, the user sees an empty
                  growing box for ~100ms before content appears — reads
                  as "loading" rather than "morphing."
                  So: tiny 40ms delay on enter (just enough to let the
                  old start dissolving) and a longer 240ms fade that
                  runs through most of the container's morph. The new
                  content is visibly emerging *alongside* the growth,
                  never after it. Same timings both directions — the
                  symmetric config happens to feel great closing too. */}
              <AnimatePresence mode="popLayout" initial={false}>
                {expanded ? (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { duration: 0.24, delay: 0.04, ease: [0.22, 1, 0.36, 1] },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
                    }}
                    role="region"
                    aria-label="Plan details"
                  >
                    <ExpandedPanel
                      planStops={planStops}
                      onRemove={removeAndMaybeCollapse}
                      onClear={clearAndCollapse}
                      onCollapse={() => setExpanded(false)}
                      onReorder={reorderStops}
                      onOpenPlanner={handleOpenPlanner}
                      opening={opening}
                      openError={openError}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="collapsed"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { duration: 0.24, delay: 0.04, ease: [0.22, 1, 0.36, 1] },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
                    }}
                    className="flex items-center gap-3 p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      aria-label="Show plan details"
                      aria-expanded={false}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      {visibleStops.length > 0 ? (
                        <div className="flex shrink-0 items-center">
                          {visibleStops.map(({ spot }, i) =>
                            spot.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={spot.id}
                                src={spot.images[0]}
                                alt=""
                                className={`w-8 h-8 rounded-full object-cover border-2 border-neutral-900 dark:border-white ${i > 0 ? "-ml-4" : ""}`}
                              />
                            ) : (
                              <div
                                key={spot.id}
                                className={`w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border-2 border-neutral-900 dark:border-white text-neutral-500 dark:text-neutral-400 ${i > 0 ? "-ml-4" : ""}`}
                              >
                                <ListOrdered size={14} />
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center border-2 border-neutral-900 dark:border-white text-neutral-500 dark:text-neutral-400">
                          <ListOrdered size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate leading-tight">
                          {count} {count === 1 ? "space" : "spaces"} in the plan
                        </div>
                      </div>
                    </button>
                    {/* Clear action — Save lives on the saved-plan editor
                        now; the tray is pure peek-and-prune. */}
                    <button
                      type="button"
                      onClick={clearAndCollapse}
                      aria-label="Clear plan"
                      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            {count >= ITINERARY_MAX_STOPS && !expanded && (
              <div className="mt-1.5 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                Plan full (max {ITINERARY_MAX_STOPS}) — open the planner to edit.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Expanded contents of the tray: header strip, scrollable stops list,
 *  footer with Clear + Open planner actions. Rendered inside the same
 *  outer fixed container so animations stay scoped to the same region. */
function ExpandedPanel({
  planStops,
  onRemove,
  onClear,
  onCollapse,
  onReorder,
  onOpenPlanner,
  opening,
  openError,
}: {
  planStops: PlanStop[];
  onRemove: (spotId: string) => void;
  onClear: () => void;
  onCollapse: () => void;
  onReorder: (activeId: string, overId: string) => void;
  onOpenPlanner: () => void;
  opening: boolean;
  openError: string | null;
}) {
  // Sensors mirror the planner's: small pointer activation distance so
  // grabbing the handle on a scrollable list doesn't steal a scroll
  // gesture, plus keyboard support so the list is fully reorderable
  // without a mouse. PointerSensor covers touch on modern browsers.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      onReorder(String(active.id), String(over.id));
    },
    [onReorder],
  );
  const itemIds = useMemo(() => planStops.map((s) => s.spot.id), [planStops]);

  return (
    <div className="flex flex-col">
      {/* Header — the collapsed pill's stop-count + summary line would
          just repeat the list below, so in the expanded state we show a
          single simple title and let the numbered rows do the talking.
          `pr-2.5` keeps the collapse chevron's center aligned with the
          per-row X buttons; the broader `px-4 py-3.5` gives the header
          enough air that it reads as a section title rather than a
          cramped toolbar. */}
      <div className="flex items-center gap-3 px-4 py-3.5 pr-2.5">
        {/* `pl-2.5` matches the Clear plan button's internal horizontal
            padding in the footer below, so "Your plan" lines up
            vertically with "Clear plan" instead of starting flush with
            the card's inner edge. */}
        <div className="pl-2.5 min-w-0 flex-1">
          <div className="text-xs font-medium truncate leading-tight">
            Your plan
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse plan"
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Stop list — internally scrollable so long plans stay bounded.
          `scrollbar-hide` matches the rest of the app's popovers so the
          list blends into the card without a system scrollbar gutter.
          dnd-kit wires drag-to-reorder via the per-row grip handle. */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ul className="max-h-[min(50vh,420px)] overflow-y-auto scrollbar-hide border-t border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
            {planStops.map(({ spot, timeLabel }, i) => (
              <SortablePlanRow
                key={spot.id}
                spot={spot}
                index={i}
                timeLabel={timeLabel}
                citySlug={citySlugFromName(spot.city)}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Footer — clear (destructive, ghost) + open-planner (saves the
          draft as a real itinerary row, then routes into the saved-plan
          editor for date, invites, and reorder). Extra horizontal padding
          pulls both buttons off the card's curved edges so the rounded
          corners frame the action row. */}
      <div className="flex flex-col gap-1.5 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 rounded-full transition-colors"
          >
            Clear plan
          </button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onOpenPlanner}
            disabled={opening}
            className="ml-auto"
          >
            {opening ? "Opening…" : "Open planner"}
          </Button>
        </div>
        {openError && (
          <div className="text-[11px] text-red-500 text-right">
            {openError}
          </div>
        )}
      </div>
    </div>
  );
}

/** Single sortable row in the tray's stops list. Thin layer around the
 *  static layout that plugs dnd-kit's `useSortable` wiring in — the grip
 *  handle at the far left is the only drag surface, so tapping anywhere
 *  else (thumbnail, name link, remove) keeps its normal behavior. The
 *  row is given `bg-surface` so a lifted drag preview stays opaque over
 *  sibling rows instead of showing the card beneath. */
function SortablePlanRow({
  spot,
  index,
  timeLabel,
  citySlug,
  onRemove,
}: {
  spot: Spot;
  index: number;
  timeLabel: string | null;
  citySlug: string;
  onRemove: (spotId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: spot.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const thumbnail = spot.images?.[0];
  const timeDisplay = formatTime(timeLabel);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 pl-1.5 pr-3 py-2 bg-surface"
    >
      <button
        type="button"
        aria-label={`Reorder ${spot.name}`}
        className="w-5 h-6 shrink-0 flex items-center justify-center text-neutral-300 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-grab active:cursor-grabbing touch-none transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} strokeWidth={1.75} />
      </button>
      {/* Thumbnail + stop-number corner pin read as one unit — a
          separate number circle next to the photo was two badges
          fighting for attention. The surface-colored ring around
          the pin gives it the "sticker" floating-above effect so
          the badge is readable against any photo. */}
      <div className="relative w-10 h-10 shrink-0">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full rounded-lg object-cover bg-neutral-100 dark:bg-neutral-800"
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        )}
        <div
          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold ring-2 ring-[var(--color-surface)]"
          aria-hidden="true"
        >
          {index + 1}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/${citySlug}/${spot.id}`}
          className="text-sm font-medium truncate leading-tight hover:underline underline-offset-2 block"
        >
          {spot.name}
        </Link>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-tight mt-0.5">
          {spot.neighborhood}
          {timeDisplay && <> · {timeDisplay}</>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(spot.id)}
        aria-label={`Remove ${spot.name}`}
        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <X size={14} />
      </button>
    </li>
  );
}
