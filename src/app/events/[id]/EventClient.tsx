"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Calendar, CalendarPlus, Clock, Users, Shirt, Globe, AtSign, Smartphone } from "lucide-react";
import { FadeIn, GalleryReveal, SectionReveal } from "@/components/ListingAnimations";
import ShareButton from "@/components/ShareButton";
import SpotGallery from "@/components/SpotGallery";
import SpotLocationMap from "@/components/SpotLocationMap";
import { EventRecord, EventRsvp, Spot } from "@/lib/types";
import { rsvpEvent, cancelRsvp } from "@/app/actions/events";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  instagram?: string | null;
}

interface Attendee extends Profile {
  status: "going" | "waitlist" | "cancelled";
  isConnected?: boolean;
}

interface Props {
  event: EventRecord;
  spot: Spot | null;
  host: Profile | null;
  attendees: Attendee[];
  goingCount: number;
  myRsvp: EventRsvp | null;
  viewerId: string | null;
}

function fullName(p: Profile | null): string {
  if (!p) return "Unknown";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure against the collapsed clientHeight (line-clamp applied)
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [text]);

  return (
    <div className="pt-1">
      <p
        ref={ref}
        className={`text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-neutral-900 dark:text-white underline underline-offset-2 hover:no-underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatWhenLine(start: string): string {
  const s = new Date(start);
  const weekday = s.toLocaleDateString("en-US", { weekday: "short" });
  const month = s.toLocaleDateString("en-US", { month: "long" });
  const day = ordinal(s.getDate());
  const time = s
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "");
  return `${weekday}, ${month} ${day} @${time}`;
}

export default function EventClient({
  event,
  spot,
  host,
  attendees,
  goingCount,
  myRsvp,
  viewerId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCancelled = event.status === "cancelled";
  const isHidden = event.status === "hidden";
  const isPaid = event.price_cents > 0;
  const isFull = event.capacity != null && goingCount >= event.capacity;

  // Sort: connected members first, then host, then everyone else
  const goingAttendees = attendees
    .filter((a) => a.status === "going")
    .slice()
    .sort((a, b) => {
      const ac = a.isConnected ? 1 : 0;
      const bc = b.isConnected ? 1 : 0;
      if (ac !== bc) return bc - ac;
      const ah = host?.id === a.id ? 1 : 0;
      const bh = host?.id === b.id ? 1 : 0;
      return bh - ah;
    });
  const waitlistAttendees = attendees.filter((a) => a.status === "waitlist");
  const connectedCount = goingAttendees.filter((a) => a.isConnected).length;

  function handleRsvp() {
    setError(null);
    startTransition(async () => {
      const res = await rsvpEvent(event.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleCancelRsvp() {
    setError(null);
    startTransition(async () => {
      const res = await cancelRsvp(event.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const whenLabel = formatWhenLine(event.starts_at);

  // Event hours: just the start–end time portion (no date) for the details grid
  const startTime = new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = new Date(event.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const eventHoursLabel = `${startTime} – ${endTime}`;

  const details: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [];
  details.push({
    icon: <Clock size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
    label: "Hours",
    value: <span className="text-sm font-medium">{eventHoursLabel}</span>,
  });
  if (event.age_restriction) {
    details.push({
      icon: <Users size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
      label: "Age",
      value: <span className="text-sm font-medium">{event.age_restriction}</span>,
    });
  }
  if (spot?.dressCode) {
    details.push({
      icon: <Shirt size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
      label: "Dress code",
      value: <span className="text-sm font-medium">{spot.dressCode}</span>,
    });
  }
  if (spot?.instagram) {
    const handle = spot.instagram.replace("@", "");
    details.push({
      icon: <AtSign size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
      label: "Instagram",
      value: (
        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline underline-offset-2">
          @{handle}
        </a>
      ),
    });
  }
  if (spot?.website) {
    details.push({
      icon: <Globe size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
      label: "Website",
      value: (
        <a href={spot.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline underline-offset-2">
          View website
        </a>
      ),
    });
  }
  if (spot?.phone) {
    details.push({
      icon: <Smartphone size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />,
      label: "Phone",
      value: (
        <a href={`tel:${spot.phone}`} className="text-sm font-medium hover:underline underline-offset-2">
          {spot.phone}
        </a>
      ),
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto relative">
      {/* Gallery — multiple event photos when available, falls back to a single cover */}
      <GalleryReveal>
        {(() => {
          const eventImages =
            event.images && event.images.length > 0
              ? event.images
              : event.cover_image_url
              ? [event.cover_image_url]
              : [];

          if (eventImages.length > 1) {
            return <SpotGallery images={eventImages} name={event.title} />;
          }

          const single = eventImages[0];
          return (
            <>
              {/* Mobile: full-bleed 4:3 */}
              <div className="md:hidden w-full aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                {single ? (
                  <img src={single} alt={event.title} className="w-full h-full object-cover spot-img" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Calendar size={64} className="text-neutral-300 dark:text-neutral-700" />
                  </div>
                )}
              </div>
              {/* Desktop: rounded card matching the spot 3-photo strip width */}
              <div className="hidden md:block px-2">
                <div className="aspect-[3/1] overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
                  {single ? (
                    <img src={single} alt={event.title} className="w-full h-full object-cover spot-img" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar size={64} className="text-neutral-300 dark:text-neutral-700" />
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </GalleryReveal>

      <div className="max-w-3xl mx-auto px-4 md:px-6 w-full">
        {/* Header */}
        <FadeIn delay={0.1}>
          <div className="pt-7 pb-2 space-y-3">
            {(spot?.vibes?.length || event.visibility === "private" || isCancelled || isHidden) && (
              <div className="flex flex-wrap gap-2">
                {spot?.vibes?.map((vibe) => (
                  <span key={vibe} className="text-xs px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                    {vibe}
                  </span>
                ))}
                {event.visibility === "private" && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                    <Lock size={11} /> Private
                  </span>
                )}
                {isCancelled && (
                  <span className="text-xs px-2.5 py-1 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400">
                    Cancelled
                  </span>
                )}
                {isHidden && (
                  <span className="text-xs px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500">
                    Hidden by admin
                  </span>
                )}
              </div>
            )}

            <div>
              <h1 className="text-[26px] font-semibold tracking-tight">{event.title}</h1>
              {spot && (
                <div className="text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed mt-1">
                  <Link href={`/${spot.city}/${spot.id}`} className="hover:underline">
                    {spot.name}
                  </Link>
                </div>
              )}
            </div>

            {/* When — prominent so the time is impossible to miss */}
            <div className="flex items-center gap-2 text-[15px] text-neutral-900 dark:text-white">
              <Calendar size={16} strokeWidth={1.75} className="text-neutral-400 dark:text-neutral-500" />
              <span className="font-medium">{whenLabel}</span>
            </div>

            {event.description && <ExpandableDescription text={event.description} />}
          </div>
        </FadeIn>

        {/* Event details */}
        {details.length > 0 && (
          <SectionReveal>
            <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
            <div>
              <h2 className="text-lg font-semibold mb-6">Event details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
                {details.map((d, i) => (
                  <div key={i}>
                    <div className="mb-2">{d.icon}</div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">{d.label}</p>
                    {d.value}
                  </div>
                ))}
              </div>
            </div>
          </SectionReveal>
        )}

        {/* Guest list (Partiful-inspired) */}
        <SectionReveal>
          <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-semibold">Guest list</h2>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {goingCount} going{event.capacity != null ? ` / ${event.capacity}` : ""}
              </span>
            </div>
            {connectedCount > 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
                {connectedCount} {connectedCount === 1 ? "person" : "people"} you follow {connectedCount === 1 ? "is" : "are"} going
              </p>
            )}
            {connectedCount === 0 && <div className="mb-5" />}

            {goingAttendees.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No one yet — be the first.
              </p>
            ) : (
              <>
                {/* Stacked avatar row */}
                {goingAttendees.length > 1 && (
                  <div className="flex items-center mb-5">
                    {goingAttendees.slice(0, 8).map((a, i) => (
                      <div
                        key={a.id}
                        className={`w-9 h-9 rounded-full ring-2 overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${
                          a.isConnected ? "ring-neutral-900 dark:ring-white" : "ring-[var(--color-surface)]"
                        }`}
                        style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 8 - i }}
                      >
                        {a.avatar_url && (
                          <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                    {goingAttendees.length > 8 && (
                      <div
                        className="w-9 h-9 rounded-full ring-2 ring-[var(--color-surface)] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[11px] font-medium text-neutral-600 dark:text-neutral-300"
                        style={{ marginLeft: -10 }}
                      >
                        +{goingAttendees.length - 8}
                      </div>
                    )}
                  </div>
                )}

                {/* Guest rows */}
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
                  {goingAttendees.map((a) => {
                    const isHost = host?.id === a.id;
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/members/${a.id}`}
                          className="flex items-center gap-3 py-2.5 group"
                        >
                          {a.avatar_url ? (
                            <img src={a.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium truncate group-hover:underline">
                                {fullName(a)}
                              </div>
                              {a.isConnected && (
                                <span className="text-[10px] uppercase tracking-wide font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-full px-1.5 py-0.5">
                                  Following
                                </span>
                              )}
                            </div>
                            {isHost && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">Host</div>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {waitlistAttendees.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                  Waitlist · {waitlistAttendees.length}
                </h3>
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
                  {waitlistAttendees.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5 opacity-60">
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                      )}
                      <span className="text-sm truncate">{fullName(a)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionReveal>

        {/* Where you'll find it */}
        {spot && (
          <SectionReveal>
            <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
            <SpotLocationMap
              spot={{
                id: spot.id,
                name: spot.name,
                category: spot.category,
                neighborhood: spot.neighborhood,
                images: spot.images,
                lng: spot.lng,
                lat: spot.lat,
              }}
              nearby={[]}
              address={spot.address}
            />
          </SectionReveal>
        )}

        {/* Host — placed at the bottom; the venue + when matter more up top */}
        {host && (
          <SectionReveal>
            <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
            <Link
              href={`/members/${host.id}`}
              className="inline-flex items-center gap-3 group"
            >
              {host.avatar_url ? (
                <img src={host.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              )}
              <div className="text-sm">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Hosted by</div>
                <div className="font-medium group-hover:underline">{fullName(host)}</div>
              </div>
            </Link>
          </SectionReveal>
        )}

        {error && (
          <div className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="h-12" />
      </div>
      </div>

      {/* Bottom action bar — fixed to viewport */}
      <div className="shrink-0 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ShareButton spotName={event.title} variant="icon" />
            <a
              href={`/api/events/${event.id}/ics`}
              download
              aria-label="Add to calendar"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              data-tooltip="Add to calendar"
            >
              <CalendarPlus size={16} strokeWidth={2} className="text-neutral-600 dark:text-neutral-300" />
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!isCancelled && !isHidden && viewerId && (
              myRsvp && myRsvp.status !== "cancelled" ? (
                <button
                  onClick={handleCancelRsvp}
                  disabled={pending}
                  className="px-6 py-2.5 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 disabled:opacity-50"
                >
                  {myRsvp.status === "going" ? "Going" : "Waitlisted"}
                </button>
              ) : isPaid ? (
                <button
                  disabled
                  className="px-6 py-2.5 rounded-full text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 opacity-50"
                  title="Paid checkout coming soon"
                >
                  Buy ticket · ${(event.price_cents / 100).toFixed(0)}
                </button>
              ) : (
                <button
                  onClick={handleRsvp}
                  disabled={pending}
                  className="px-6 py-2.5 rounded-full text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
                >
                  {isFull ? "Join waitlist" : "Attend"}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
