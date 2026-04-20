"use client";

// Saved-plan polish surface at `/[city]/itinerary/[id]`.
//
// This is where a plan goes once it's been built on the city page via the
// bottom tray — the user lands here to pick a date, invite friends, copy
// a share link, and (if they want) reorder or remove stops. It is NOT a
// builder: there's no candidate grid, no criteria row, no recommendations.
// Adding spaces means going back to `/[city]` where the tray lives.
//
// Two modes, determined by `plan.isOwner`:
// - Owner: full edit (reorder, remove, date pick, invite, delete, update).
// - Invitee: read-only view of stops + invitee list, with a single
//   "Leave plan" button replacing the action bar.
//
// Mobile: the hero map strip is hidden below the `md` breakpoint — we
// lean on the stop list and the tray's own map context on the city page.

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
import { Button } from "@/components/ui/Button";
import { ITINERARY_MAX_STOPS, type Itinerary, type Spot } from "@/lib/types";
import {
  deleteItinerary,
  inviteItineraryMembers,
  leaveItinerary,
  removeItineraryInvite,
  saveItinerary,
  searchMembersForItineraryInvite,
} from "@/app/actions/itineraries";
import type { MemberSearchResult } from "@/app/actions/events";
import SpotMap from "@/components/Map";
import StopRow from "./StopRow";
import { DateChip } from "./DateChip";
import InviteMembersField, { memberLabel } from "./InviteMembersField";

type Item = { spotId: string; timeLabel: string | null };

interface Props {
  plan: Itinerary;
  citySlug: string;
  cityName: string;
  /** Every spot in the plan's city — used for thumbnails, map coords, and
   *  the stop-lookup map. Loaded server-side. */
  citySpots: Spot[];
  /** Owner-only. Preloaded invitees so the first paint doesn't flicker. */
  initialInvitees: MemberSearchResult[];
}

export default function SavedPlanEditor({
  plan,
  citySlug,
  cityName,
  citySpots,
  initialInvitees,
}: Props) {
  const router = useRouter();
  const isOwner = plan.isOwner !== false;

  // --- Core plan state ---------------------------------------------------
  const [items, setItems] = useState<Item[]>(
    plan.items.map((it) => ({ spotId: it.spotId, timeLabel: it.timeLabel })),
  );
  const [date, setDate] = useState<string | null>(plan.date);
  const [invitees, setInvitees] = useState<MemberSearchResult[]>(initialInvitees);
  // Snapshot the initial invitee IDs so Save can diff and issue the
  // right add/remove calls — mirrors NewEventClient's pattern.
  const [originalInviteeIds] = useState<Set<string>>(
    () => new Set(initialInvitees.map((m) => m.id)),
  );

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leavePending, startLeave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  // Portal gate: PageShell wraps children in an element with the
  // `page-enter` animation, which leaves a residual `transform` on the
  // final frame. That turns the wrapper into the containing block for
  // `position: fixed`, so the action bar gets trapped inside the
  // max-width column. Portal to document.body to escape.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  const spotById = useMemo(() => {
    const m = new Map<string, Spot>();
    for (const s of citySpots) m.set(s.id, s);
    return m;
  }, [citySpots]);

  // Filter out orphans — stops whose spot no longer exists in the city
  // list (rekeyed / deleted). The reader drops them silently.
  const visibleItems = useMemo(
    () => items.filter((it) => spotById.has(it.spotId)),
    [items, spotById],
  );

  const stopCount = visibleItems.length;

  // Ordered list of ids for the SpotMap's numbered corner pins + route.
  const planStopIds = useMemo(
    () => visibleItems.map((it) => it.spotId),
    [visibleItems],
  );
  // The map's full spot set: every city spot so coords are available,
  // but we only render pins/route for the stops in the plan.
  const mapSpots = useMemo(() => {
    const ids = new Set(planStopIds);
    return citySpots.filter((s) => ids.has(s.id));
  }, [citySpots, planStopIds]);

  // --- dnd-kit -----------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.spotId === active.id);
      const newIndex = prev.findIndex((it) => it.spotId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function removeItem(spotId: string) {
    setItems((prev) => prev.filter((it) => it.spotId !== spotId));
  }

  // --- Save / delete / leave / share ------------------------------------
  async function handleSave() {
    if (!isOwner || stopCount === 0) return;
    setSaveState("saving");
    setSaveError(null);

    const res = await saveItinerary({
      id: plan.id,
      city: cityName,
      // Name is intentionally empty — the server action coerces "" to the
      // "Untitled plan" fallback for list views that still show it.
      name: "",
      items: visibleItems.map((it) => ({
        spotId: it.spotId,
        timeLabel: it.timeLabel,
      })),
      date,
      // Pass through criteria untouched — the tray still writes them on
      // save from the city page, and we don't want to stomp those here.
      activities: plan.activities,
      vibes: plan.vibes,
      neighborhoods: plan.neighborhoods,
    });

    if (!res.success) {
      const msg =
        res.error === "too_many_stops"
          ? `Maximum ${ITINERARY_MAX_STOPS} spaces per plan.`
          : res.error === "empty"
            ? "Add at least one space before saving."
            : res.error === "unauthenticated"
              ? "Sign in to save your plan."
              : "Couldn't save — try again.";
      setSaveState("error");
      setSaveError(msg);
      return;
    }

    // Diff invitees against the snapshot and fan out the add/remove calls.
    // Failures here don't block the save-confirmation — the plan itself
    // persisted — but we surface the first error as a soft message.
    const nextIds = invitees.map((m) => m.id);
    const toRemove = [...originalInviteeIds].filter(
      (id) => !nextIds.includes(id),
    );
    const toAdd = nextIds.filter((id) => !originalInviteeIds.has(id));
    let inviteError: string | null = null;
    if (toRemove.length > 0) {
      const results = await Promise.all(
        toRemove.map((id) => removeItineraryInvite(plan.id, id)),
      );
      const firstErr = results.find((r) => !r.ok);
      if (firstErr && !firstErr.ok) inviteError = firstErr.error;
    }
    if (toAdd.length > 0) {
      const r = await inviteItineraryMembers(plan.id, toAdd);
      if (!r.ok) inviteError = inviteError ?? r.error;
    }

    // Refresh the snapshot so subsequent saves diff against the new baseline.
    originalInviteeIds.clear();
    for (const id of nextIds) originalInviteeIds.add(id);

    setSaveState("saved");
    if (inviteError) {
      // Keep the user on the page so they can see the invite-side error.
      setSaveError(`Plan saved. Invites: ${inviteError}`);
      setTimeout(() => setSaveState("idle"), 2000);
      router.refresh();
      return;
    }

    // Happy path: bounce back to the plans hub.
    router.push("/plans");
  }

  function handleDelete() {
    if (!isOwner) return;
    if (!confirm("Delete this plan? This can't be undone.")) return;
    startDelete(async () => {
      await deleteItinerary(plan.id);
      router.push("/plans");
    });
  }

  function handleLeave() {
    if (isOwner) return;
    if (!confirm("Leave this plan? You'll need a new invite to rejoin."))
      return;
    startLeave(async () => {
      await leaveItinerary(plan.id);
      router.push("/plans");
    });
  }

  // --- Derived copy ------------------------------------------------------
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : "Save plan";

  return (
    <div className="mx-auto max-w-2xl pb-24 space-y-8">
      {/* No header: the identity (date + city + stop count) is carried by
          the When section + the Spaces list. The plan page drops straight
          into the map strip to keep the surface feeling like a polish
          view, not a doc. */}

      {/* Map hero strip — desktop only. Just the numbered pins; no
          connecting route, and no locate/zoom controls — this view is a
          polish header, not an interactive map. */}
      {planStopIds.length > 0 && (
        <div className="hidden md:block h-[260px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <SpotMap
            spots={mapSpots}
            activeSpot={null}
            onSpotSelect={() => {}}
            planStopIds={planStopIds}
            hideControls
          />
        </div>
      )}

      {/* Date */}
      <Section title="Date">
        {isOwner ? (
          <DateChip value={date} onChange={setDate} />
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {date
              ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "No date set yet."}
          </p>
        )}
      </Section>

      {/* Spaces */}
      <Section title="Spaces">
        {visibleItems.length === 0 ? (
          <p className="text-sm text-neutral-500">
            This plan has no spaces yet.{" "}
            {isOwner && (
              <Link
                href={`/${citySlug}`}
                className="underline hover:text-neutral-900 dark:hover:text-white"
              >
                Browse {cityName}
              </Link>
            )}
          </p>
        ) : isOwner ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={visibleItems.map((it) => it.spotId)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1">
                {visibleItems.map((it, i) => {
                  const spot = spotById.get(it.spotId)!;
                  return (
                    <StopRow
                      key={it.spotId}
                      spot={spot}
                      position={i}
                      onRemove={() => removeItem(it.spotId)}
                      onHover={() => {}}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ReadOnlyStopList items={visibleItems} spotById={spotById} />
        )}
      </Section>

      {/* Invites — owner gets the search field, invitee gets a read-only
          list. */}
      {isOwner ? (
        <Section title="Invites">
          <InviteMembersField
            invitees={invitees}
            onChange={setInvitees}
            search={(q) => searchMembersForItineraryInvite(plan.id, q)}
          />
        </Section>
      ) : invitees.length > 0 ? (
        <Section title="Invites">
          <ReadOnlyInviteeList invitees={invitees} />
        </Section>
      ) : null}

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      {/* Sticky action bar — portaled to <body> so it escapes the
          PageShell `.page-enter` wrapper (which leaves a residual
          transform that would otherwise trap `position: fixed`). */}
      {portalReady &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto max-w-2xl flex items-center justify-between gap-2">
              {isOwner ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleDelete}
                    disabled={deletePending || saveState === "saving"}
                    className="text-red-500 hover:text-red-600"
                  >
                    {deletePending ? "Deleting…" : "Delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    disabled={saveState === "saving" || stopCount === 0}
                  >
                    {saveLabel}
                  </Button>
                </>
              ) : (
                <>
                  <div />
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleLeave}
                    disabled={leavePending}
                  >
                    {leavePending ? "Leaving…" : "Leave plan"}
                  </Button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-neutral-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Invitee-mode stop list. Same visual rhythm as StopRow but every
 *  control is stripped: no drag handle, no remove X, no hover ping.
 *  Keeps the visual hierarchy consistent with edit mode. */
function ReadOnlyStopList({
  items,
  spotById,
}: {
  items: Item[];
  spotById: Map<string, Spot>;
}) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => {
        const spot = spotById.get(it.spotId)!;
        const thumbnail = spot.images?.[0];
        return (
          <li
            key={it.spotId}
            className="flex items-center gap-3 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface"
          >
            <div
              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold"
              aria-hidden="true"
            >
              {i + 1}
            </div>
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
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
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReadOnlyInviteeList({
  invitees,
}: {
  invitees: MemberSearchResult[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {invitees.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-surface text-xs text-neutral-700 dark:text-neutral-200"
        >
          {m.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.avatar_url}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-medium text-neutral-600 dark:text-neutral-300">
              {(m.first_name?.[0] || m.instagram?.[0] || "?").toUpperCase()}
            </span>
          )}
          {memberLabel(m)}
        </span>
      ))}
    </div>
  );
}
