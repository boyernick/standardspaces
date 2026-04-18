"use client";

// Read-only rendering of an itinerary for the public /share route.
// Mirrors the planner's visual layout but strips all editing affordances
// (drag handles, time inputs, remove buttons, save bar). Offers a
// "Duplicate to edit" CTA that writes the contents — including v2
// criteria (date, activities, vibes, neighborhoods) — into the viewer's
// localStorage draft and redirects them into the planner where they can
// modify.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { citySlugFromName } from "@/lib/cities";
import { ACTIVITIES_BY_ID, type Spot } from "@/lib/types";
import { formatTime } from "@/lib/itinerary-url";
import { writeDraftImperative } from "@/hooks/useItineraryDraft";
import ItineraryMap, { type ItineraryMapStop } from "./ItineraryMap";

type SharedItem = { spotId: string; timeLabel: string | null };

export interface ItineraryViewProps {
  citySlug: string;
  cityName: string;
  name: string;
  items: SharedItem[];
  spots: Spot[]; // resolved subset that matched valid IDs
  /** v2 — ISO yyyy-mm-dd, or null. */
  date?: string | null;
  /** v2 — selected `Activity.id`s. */
  activities?: string[];
  /** v2 — selected vibe labels. */
  vibes?: string[];
  /** v2 — selected neighborhood names. */
  neighborhoods?: string[];
}

export default function ItineraryView({
  citySlug,
  cityName,
  name,
  items,
  spots,
  date = null,
  activities = [],
  vibes = [],
  neighborhoods = [],
}: ItineraryViewProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const spotById = new Map(spots.map((s) => [s.id, s]));
  const stops: ItineraryMapStop[] = items
    .map((it, i) => {
      const s = spotById.get(it.spotId);
      if (!s) return null;
      return {
        spotId: s.id,
        name: s.name,
        lng: s.lng,
        lat: s.lat,
        position: i,
      };
    })
    .filter((v): v is ItineraryMapStop => v !== null);

  async function handleCopyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDuplicate() {
    startTransition(() => {
      writeDraftImperative({
        city: citySlug,
        name,
        items: items.map((it) => ({
          spotId: it.spotId,
          timeLabel: it.timeLabel ?? undefined,
        })),
        date,
        activities,
        vibes,
        neighborhoods,
      });
      router.push(`/${citySlug}/itinerary`);
    });
  }

  const displayName = name.trim() || "A plan in " + cityName;
  const stopCount = stops.length;

  const activityLabels = activities
    .map((id) => ACTIVITIES_BY_ID[id]?.label)
    .filter((x): x is string => Boolean(x));

  const dateLabel = (() => {
    if (!date) return null;
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  })();

  const hasCriteria =
    !!dateLabel ||
    activityLabels.length > 0 ||
    vibes.length > 0 ||
    neighborhoods.length > 0;

  return (
    <div className="h-full flex flex-col split:flex-row">
      {/* Left column: list */}
      <div className="w-full split:w-[45%] lg:w-[40%] split:min-w-[380px] split:shrink-0 flex flex-col overflow-hidden">
        <div className="px-4 md:px-6 pt-4 pb-3 shrink-0 border-b border-neutral-200 dark:border-neutral-800">
          <Link
            href={`/${citySlug}`}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-2"
          >
            <ArrowLeft size={12} /> {cityName}
          </Link>
          <h1 className="text-xl md:text-2xl font-medium">{displayName}</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {stopCount === 0
              ? "No valid spaces in this plan."
              : `${stopCount} ${stopCount === 1 ? "space" : "spaces"} · ${cityName}`}
          </p>

          {hasCriteria && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {dateLabel && (
                <ReadOnlyChip icon={<CalendarIcon size={11} />} label={dateLabel} />
              )}
              {activityLabels.map((label) => (
                <ReadOnlyChip
                  key={`act-${label}`}
                  icon={<Utensils size={11} />}
                  label={label}
                />
              ))}
              {vibes.map((v) => (
                <ReadOnlyChip
                  key={`vibe-${v}`}
                  icon={<Sparkles size={11} />}
                  label={v}
                />
              ))}
              {neighborhoods.map((n) => (
                <ReadOnlyChip
                  key={`hood-${n}`}
                  icon={<MapPin size={11} />}
                  label={n}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {stopCount === 0 ? (
            <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">
              This share link is empty or references spaces that no longer
              exist.
            </div>
          ) : (
            <ul className="px-4 md:px-6 py-3 space-y-2">
              {items.map((it, i) => {
                const spot = spotById.get(it.spotId);
                if (!spot) return null;
                const thumbnail = spot.images?.[0];
                const timeDisplay = formatTime(it.timeLabel);
                const reserveUrl = spot.bookingUrl?.trim();
                const reserveLabel = spot.bookingPlatform
                  ? `Reserve on ${spot.bookingPlatform}`
                  : "Reserve";
                return (
                  <li
                    key={`${it.spotId}-${i}`}
                    className="flex items-center gap-3 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface"
                  >
                    <div
                      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: "var(--color-brand-500, #FD5304)" }}
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
                      <Link
                        href={`/${citySlugFromName(spot.city)}/${spot.id}`}
                        className="text-sm font-medium truncate hover:underline underline-offset-2 block"
                      >
                        {spot.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="truncate">{spot.neighborhood}</span>
                        {timeDisplay && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock size={10} /> {timeDisplay}
                            </span>
                          </>
                        )}
                        {reserveUrl && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a
                              href={reserveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
                              aria-label={reserveLabel}
                              title={reserveLabel}
                            >
                              Reserve
                              <ExternalLink size={9} />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-surface px-4 md:px-6 py-3 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            aria-label="Copy share link"
          >
            {copied ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy link
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleDuplicate}
            disabled={stopCount === 0 || isPending}
          >
            Duplicate to edit
          </Button>
        </div>
      </div>

      {/* Right column: map — mirrors the planner's bordered, padded
          map well so the share view matches the city page's chrome. */}
      <div className="flex-1 min-h-0 relative px-4 pb-4 split:pt-1.5">
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
          <ItineraryMap stops={stops} />
        </div>
      </div>
    </div>
  );
}

/** Tiny read-only chip mirroring the planner's criteria row style. No
 *  click target — this view is display-only. */
function ReadOnlyChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border bg-surface text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800">
      <span className="opacity-70" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}
