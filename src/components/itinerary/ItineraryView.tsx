"use client";

// Read-only rendering of an itinerary for the public /share route (v1).
// Mirrors the planner's visual layout but strips all editing affordances
// (drag handles, time inputs, remove buttons, save bar). Offers a
// "Duplicate to edit" CTA that writes the contents into the viewer's
// localStorage draft and redirects them into the planner.
//
// V2's criteria-chip row (date / activity / vibe / neighborhood) lives
// in `ItineraryViewV2.tsx` — preserved alongside this file for when we
// revisit the richer planning UX.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { citySlugFromName } from "@/lib/cities";
import { type Spot } from "@/lib/types";
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
}

export default function ItineraryView({
  citySlug,
  cityName,
  name,
  items,
  spots,
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
      });
      router.push(`/${citySlug}/itinerary`);
    });
  }

  const displayName = name.trim() || "A plan in " + cityName;
  const stopCount = stops.length;

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

      {/* Right column: map. On mobile drops to a fixed-height band
          below the list. */}
      <div className="h-[40vh] split:h-auto split:flex-1 min-h-0 relative px-4 pb-4 split:pt-1.5">
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative">
          <ItineraryMap stops={stops} />
        </div>
      </div>
    </div>
  );
}
