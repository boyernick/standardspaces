import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpotById, getSpotsByCity, getChildSpots } from "@/lib/data";
import { getVisibleEventsForSpot } from "@/lib/events";
import { CATEGORY_LABELS } from "@/lib/types";
import EventCard from "@/components/EventCard";
import Navbar from "@/components/Navbar";
import SpotGallery from "@/components/SpotGallery";
import SpotLocationMap from "@/components/SpotLocationMap";
import ShareButton from "@/components/ShareButton";
import FavoriteButtonClient from "@/components/FavoriteButtonClient";
import WishlistButtonClient from "@/components/WishlistButtonClient";
import CheckInButton from "@/components/CheckInButton";
import SpotRatingInline from "@/components/SpotRatingInline";
import { createClient } from "@/lib/supabase/server";
import { getSpotAggregate } from "@/app/actions/ratings";
import { Clock, Shirt, Car, MapPin, Newspaper, Smartphone, Globe, AtSign, CalendarCheck } from "lucide-react";
import { FadeIn, GalleryReveal, SectionReveal } from "@/components/ListingAnimations";
import { NewBadge } from "@/lib/new-badge";
import TrackView from "@/components/TrackView";

// Force dynamic rendering — cannot statically prerender because <Navbar />
// reads cookies via next/headers for the per-user avatar + badge counts.
// With generateStaticParams still declared, Next would try to SSG each
// spot page at build time and crash with "Page changed from static to
// dynamic at runtime" → 500 in production on every /miami/[id] URL.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const spot = await getSpotById(id);
  if (!spot) return { title: "Not Found | Standard Spaces" };

  const title = `${spot.name} | Standard Spaces`;
  const description = spot.description.length > 160
    ? spot.description.slice(0, 157) + "..."
    : spot.description;
  const subtitle = [
    spot.category.map((c) => CATEGORY_LABELS[c]).join(", "),
    spot.neighborhood,
    spot.city,
  ].join(" · ");

  return {
    title,
    description,
    openGraph: {
      title: spot.name,
      description: `${subtitle}${spot.priceRange ? ` · ${spot.priceRange}` : ""} — ${description}`,
      siteName: "Standard Spaces",
      type: "website",
      images: spot.images[0] ? [{ url: spot.images[0], width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: spot.name,
      description: subtitle,
      images: spot.images[0] ? [spot.images[0]] : [],
    },
  };
}

function getCompactHours(hours: string): string | null {
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lines: { day: string; times: string }[] = [];

  const dailyMatch = hours.match(/^Daily\s+(.+)$/i);
  if (dailyMatch) return `Daily ${dailyMatch[1].trim()}`;

  const rangeMatch = hours.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[-–]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(.+)$/i);
  if (rangeMatch) {
    const startIdx = ALL_DAYS.indexOf(rangeMatch[1]);
    const endIdx = ALL_DAYS.indexOf(rangeMatch[2]);
    const times = rangeMatch[3].trim();
    if (startIdx >= 0 && endIdx >= 0) {
      let i = startIdx;
      while (true) {
        lines.push({ day: ALL_DAYS[i], times });
        if (i === endIdx) break;
        i = (i + 1) % 7;
      }
    }
  }

  if (lines.length === 0) {
    const dayPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g;
    const parts = hours.split(dayPattern).filter(Boolean);
    for (let i = 0; i < parts.length - 1; i += 2) {
      const day = parts[i].trim();
      let times = parts[i + 1].replace(/^[,\s·]+/, "").replace(/[,\s·]+$/, "").trim();
      times = times.replace(/,\s*/g, ", ");
      if (day && times) lines.push({ day, times });
    }
  }

  if (lines.length === 0) return null;

  const dayMap = new Map(lines.map((l) => [l.day, l.times]));
  const full = ALL_DAYS.map((d) => dayMap.get(d) ?? "Closed");
  const unique = [...new Set(full.filter((t) => t !== "Closed"))];

  if (unique.length === 1 && full.every((t) => t !== "Closed")) {
    return `Daily ${unique[0]}`;
  }

  const weekday = full.slice(0, 5);
  const weekend = full.slice(5);
  const uniqueWeekday = [...new Set(weekday)];
  const uniqueWeekend = [...new Set(weekend)];

  if (uniqueWeekday.length === 1 && uniqueWeekend.length === 1) {
    if (uniqueWeekend[0] === "Closed") return `Mon–Fri ${uniqueWeekday[0]}`;
    if (uniqueWeekday[0] === uniqueWeekend[0]) return `Daily ${uniqueWeekday[0]}`;
    return `Mon–Fri ${uniqueWeekday[0]} · Sat–Sun ${uniqueWeekend[0]}`;
  }

  return null;
}

function getOpenStatus(hours: string): string | null {
  const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ALL_DAYS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const today = ALL_DAYS[now.getDay()];
  const yesterday = ALL_DAYS[(now.getDay() + 6) % 7];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const compact = getCompactHours(hours);

  // Build day → times map across all supported formats ("Daily X",
  // "Mon–Fri X", "Mon X, Tue Y, …").
  const dayMap = new Map<string, string>();
  const dailyMatch = hours.match(/^Daily\s+(.+)$/i);
  if (dailyMatch) {
    const t = dailyMatch[1].trim();
    for (const d of ALL_DAYS_FULL) dayMap.set(d, t);
  } else {
    const rangeMatch = hours.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[-–]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(.+)$/i);
    if (rangeMatch) {
      const startIdx = ALL_DAYS_FULL.indexOf(rangeMatch[1]);
      const endIdx = ALL_DAYS_FULL.indexOf(rangeMatch[2]);
      const times = rangeMatch[3].trim();
      if (startIdx >= 0 && endIdx >= 0) {
        let i = startIdx;
        while (true) {
          dayMap.set(ALL_DAYS_FULL[i], times);
          if (i === endIdx) break;
          i = (i + 1) % 7;
        }
      }
    } else {
      const dayPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g;
      const parts = hours.split(dayPattern).filter(Boolean);
      for (let i = 0; i < parts.length - 1; i += 2) {
        const day = parts[i].trim();
        const times = parts[i + 1].replace(/^[,\s·]+/, "").replace(/[,\s·]+$/, "").trim();
        if (day && times) dayMap.set(day, times);
      }
    }
  }

  // Parse time like "6AM–11:30PM" or "6PM-2AM"
  function parseTime(t: string): number | null {
    const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = m[2] ? parseInt(m[2]) : 0;
    const period = m[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }
  function parseRange(timeStr: string): { open: number; close: number; openStr: string; closeStr: string } | null {
    const p = timeStr.split(/[-–]/);
    if (p.length !== 2) return null;
    const open = parseTime(p[0]);
    const close = parseTime(p[1]);
    if (open === null || close === null) return null;
    return { open, close, openStr: p[0].trim(), closeStr: p[1].trim() };
  }

  // Overnight carry-over: if yesterday had an overnight block (e.g. Sat 10PM–2AM)
  // and we're still inside its tail past midnight, we're still open.
  const yTimes = dayMap.get(yesterday);
  if (yTimes && yTimes.toLowerCase() !== "closed") {
    const y = parseRange(yTimes);
    if (y && y.close <= y.open && currentMinutes < y.close) {
      return `Open now · Closes at ${y.closeStr}`;
    }
  }

  const todayTimes = dayMap.get(today) ?? null;
  if (!todayTimes || todayTimes.toLowerCase() === "closed") {
    return compact ? `Closed · ${compact}` : "Closed";
  }

  const t = parseRange(todayTimes);
  if (t) {
    const isOvernight = t.close <= t.open;
    if (isOvernight) {
      if (currentMinutes >= t.open || currentMinutes < t.close) {
        return `Open now · Closes at ${t.closeStr}`;
      }
      return `Closed · Opens at ${t.openStr}`;
    }
    if (currentMinutes >= t.open && currentMinutes < t.close) {
      return `Open now · Closes at ${t.closeStr}`;
    }
    return `Closed · Opens at ${t.openStr}`;
  }

  return compact ?? todayTimes;
}

function HoursDisplay({ hours, compact = false }: { hours: string; compact?: boolean }) {
  if (compact) {
    const summary = getCompactHours(hours);
    if (summary) {
      return <span className="text-sm text-neutral-700 dark:text-neutral-300">{summary}</span>;
    }
  }

  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lines: { day: string; times: string }[] = [];

  // "Daily X–Y"
  const dailyMatch = hours.match(/^Daily\s+(.+)$/i);
  if (dailyMatch) {
    ALL_DAYS.forEach((d) => lines.push({ day: d, times: dailyMatch[1].trim() }));
  }

  // "Mon - Sun 6PM-2AM" or "Mon-Sun 6PM-2AM" (range format)
  if (lines.length === 0) {
    const rangeMatch = hours.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[-–]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(.+)$/i);
    if (rangeMatch) {
      const startIdx = ALL_DAYS.indexOf(rangeMatch[1]);
      const endIdx = ALL_DAYS.indexOf(rangeMatch[2]);
      const times = rangeMatch[3].trim();
      if (startIdx >= 0 && endIdx >= 0) {
        let i = startIdx;
        while (true) {
          lines.push({ day: ALL_DAYS[i], times });
          if (i === endIdx) break;
          i = (i + 1) % 7;
        }
      }
    }
  }

  // Individual days: "Mon 7AM–11AM · Tue 7AM–11AM"
  if (lines.length === 0) {
    const dayPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g;
    const parts = hours.split(dayPattern).filter(Boolean);
    for (let i = 0; i < parts.length - 1; i += 2) {
      const day = parts[i].trim();
      let times = parts[i + 1].replace(/^[,\s·]+/, "").replace(/[,\s·]+$/, "").trim();
      times = times.replace(/,\s*/g, ", ");
      if (day && times) lines.push({ day, times });
    }
  }

  if (lines.length === 0) {
    return <span className="text-sm text-neutral-700 dark:text-neutral-300">{hours}</span>;
  }

  // Fill missing days with "Closed"
  const dayMap = new Map(lines.map((l) => [l.day, l.times]));
  const full = ALL_DAYS.map((d) => ({ day: d, times: dayMap.get(d) ?? "Closed" }));

  return (
    <div className="flex justify-between">
      {full.map(({ day, times }) => (
        <div key={day} className="flex flex-col items-center text-center min-w-0">
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{day}</span>
          <span className={`text-sm mt-1 ${times === "Closed" ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-700 dark:text-neutral-300"}`}>{times}</span>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-neutral-700 dark:text-white underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600 hover:decoration-neutral-500 dark:hover:decoration-neutral-400 transition-colors">
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
      <div className="w-5 h-5 shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{label}</p>
        <p className="text-[13px] text-neutral-700 dark:text-neutral-300 mt-0.5">{content}</p>
      </div>
    </div>
  );
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  const { id } = await params;
  const spot = await getSpotById(id);

  if (!spot) {
    notFound();
  }

  // Spot pages are shareable — an unauthenticated visitor opening a link
  // from a friend sees the full content with public CTAs in place of the
  // authed toolbar (Wishlist / Favorite / Check-in) and member Navbar.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const [allCitySpots, spotEvents, ratingAggregate, childSpots, parentSpot] =
    await Promise.all([
      getSpotsByCity(spot.city),
      getVisibleEventsForSpot(spot.id),
      getSpotAggregate(spot.id),
      getChildSpots(spot.id),
      spot.parentSpotId ? getSpotById(spot.parentSpotId) : Promise.resolve(null),
    ]);
  const nearby = allCitySpots
    .filter((s) => s.neighborhood === spot.neighborhood && s.id !== spot.id)
    .slice(0, 3);
  const spotNamesMap = { [spot.id]: spot.name };
  const citySlug = spot.city.toLowerCase().replace(/ /g, "-");

  const hasPlanVisit = spot.hours || spot.dressCode || spot.parking || spot.reservations || spot.menuUrl || spot.instagram || spot.website || spot.phone;

  const bookingLabel = spot.bookingPlatform === "Resy"
    ? "Reserve on Resy"
    : spot.bookingPlatform === "OpenTable"
    ? "Reserve on OpenTable"
    : spot.bookingPlatform === "SevenRooms"
    ? "Reserve"
    : spot.category.includes("hotels")
    ? "Book a stay"
    : "Book now";

  // Primary action for the bottom action bar. Booking wins; fall back to
  // the space's website, then Instagram, and finally Google Maps directions
  // (available for every space with an address) so the bar always has a CTA.
  const primaryAction = spot.bookingUrl
    ? { href: spot.bookingUrl, label: bookingLabel }
    : spot.website
    ? { href: spot.website, label: "Visit website" }
    : spot.instagram
    ? {
        href: `https://instagram.com/${spot.instagram.replace("@", "")}`,
        label: "View on Instagram",
      }
    : spot.address
    ? {
        href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(spot.address)}`,
        label: "Get directions",
      }
    : null;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <TrackView kind="spot" spotId={spot.id} city={spot.city} />
      {isAuthenticated ? (
        <Navbar />
      ) : (
        // Lightweight public header for shared-link viewers — logo only.
        // Sign in / Apply to join live in the bottom action bar so the
        // header stays quiet and the CTAs are thumb-reachable.
        <header className="shrink-0 bg-surface sticky top-0 z-40">
          <div className="px-4 py-2.5 flex items-center">
            {/* h-10 matches the signed-in Navbar's profile pill so the
                unauth header lands at the same 60px total height as the
                member Navbar — no layout shift between the two states. */}
            <Link href="/" className="flex items-center gap-1 h-10">
              <Image
                src="/logo.svg"
                alt="Standard Spaces"
                width={20}
                height={20}
                priority
                className="h-5 w-5 nav-logo dark:invert"
              />
              <span
                className="text-lg tracking-tight whitespace-nowrap text-neutral-900 dark:text-white nav-title"
                style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
              >
                Standard Spaces
              </span>
            </Link>
          </div>
        </header>
      )}
      <div className="flex-1 overflow-y-auto relative">
        <GalleryReveal>
          <SpotGallery images={spot.images} name={spot.name} />
        </GalleryReveal>

        <div className="max-w-3xl mx-auto px-4 md:px-6">
          {/* Header */}
          <FadeIn delay={0.1}>
            <div className="pt-7 pb-2 space-y-3">
              {spot.vibes && spot.vibes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {spot.vibes.map((vibe) => (
                    <span key={vibe} className="text-xs px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                      {vibe}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <h1 className="text-[26px] font-semibold tracking-tight">{spot.name}</h1>
                <NewBadge spot={spot} />
              </div>
              {/* Parent-spot cross-link: surface the containing venue as
                  an inline "Inside X →" chip right under the title so the
                  relationship is immediately legible (e.g. La Selva →
                  Amazónico). Clicks take the visitor to the parent page. */}
              {parentSpot && (
                <Link
                  href={`/${citySlug}/${parentSpot.id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Inside <span className="font-medium text-neutral-700 dark:text-neutral-200 group-hover:underline">{parentSpot.name}</span>
                </Link>
              )}
              <p className="text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {spot.description}
              </p>
              <SpotRatingInline initialAggregate={ratingAggregate} />
            </div>
          </FadeIn>


          {/* Events */}
          {spotEvents.length > 0 && (
            <SectionReveal>
              <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-semibold mb-4">Upcoming events</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-hide">
                  {spotEvents.map((event) => (
                    <div key={event.id} className="snap-start">
                      <EventCard event={event} spotName={spotNamesMap[event.spot_id]} />
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>
          )}

          {/* Plan your visit */}
          {hasPlanVisit && (
            <SectionReveal>
              <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-semibold mb-6">Plan your visit</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
                  {spot.menuUrl && (
                    <div>
                      <Newspaper size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Menu</p>
                      <a href={spot.menuUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline underline-offset-2">View full menu</a>
                    </div>
                  )}
                  {spot.website && (
                    <div>
                      <Globe size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Website</p>
                      <a href={spot.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline underline-offset-2">View website</a>
                    </div>
                  )}
                  {spot.instagram && (
                    <div>
                      <AtSign size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Instagram</p>
                      <a href={`https://instagram.com/${spot.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline underline-offset-2">@{spot.instagram.replace("@", "")}</a>
                    </div>
                  )}
                  {spot.phone && (
                    <div>
                      <Smartphone size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Phone</p>
                      <a href={`tel:${spot.phone}`} className="text-sm font-medium hover:underline underline-offset-2">{spot.phone}</a>
                    </div>
                  )}
                  {spot.hours && (
                    <div>
                      <Clock size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Hours</p>
                      <p className="text-sm font-medium">{getOpenStatus(spot.hours)}</p>
                    </div>
                  )}
                  {spot.dressCode && (
                    <div>
                      <Shirt size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Dress code</p>
                      <p className="text-sm font-medium">{spot.dressCode}</p>
                    </div>
                  )}
                  {spot.reservations && (
                    <div>
                      <CalendarCheck size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Reservations</p>
                      <p className="text-sm font-medium">{spot.reservations}</p>
                    </div>
                  )}
                  {spot.parking && (
                    <div>
                      <Car size={18} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Parking</p>
                      <p className="text-sm font-medium">{spot.parking}</p>
                    </div>
                  )}
                </div>
              </div>
            </SectionReveal>
          )}

          {/* Venues inside — rendered on the *parent*'s detail page and
              lists every child spot pointing at this one. Carousel of
              compact cards so a hotel lobby + a bar + a speakeasy can
              all sit in the same row without dominating the layout. */}
          {childSpots.length > 0 && (
            <SectionReveal>
              <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-semibold mb-4">Venues inside</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-hide">
                  {childSpots.map((child) => (
                    <Link
                      key={child.id}
                      href={`/${citySlug}/${child.id}`}
                      className="snap-start w-[220px] shrink-0 block rounded-2xl overflow-hidden card-edge card-edge-hover group"
                    >
                      <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-800 relative">
                        {child.images[0] ? (
                          <Image
                            src={child.images[0]}
                            alt={child.name}
                            fill
                            sizes="220px"
                            className="object-cover group-hover:scale-[1.02] transition-transform"
                          />
                        ) : null}
                      </div>
                      <div className="p-3 bg-surface">
                        <h3 className="text-sm font-semibold line-clamp-1">{child.name}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {child.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </SectionReveal>
          )}

          {/* Where you'll find it */}
          <SectionReveal>
          <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
          <SpotLocationMap
            spot={{ id: spot.id, name: spot.name, category: spot.category, neighborhood: spot.neighborhood, images: spot.images, lng: spot.lng, lat: spot.lat }}
            nearby={nearby.map((s) => ({ id: s.id, name: s.name, category: s.category, neighborhood: s.neighborhood, images: s.images, lng: s.lng, lat: s.lat }))}
            address={spot.address}
          />
          </SectionReveal>

          <div className="h-12" />
        </div>
      </div>

      {/* Bottom action bar — fixed to viewport on all sizes */}
      <div className="shrink-0 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ShareButton
              title="Share space"
              spotName={spot.name}
              spotImage={spot.images[0]}
              spotSubtitle={[spot.neighborhood, spot.city].filter(Boolean).join(" · ")}
              variant="icon"
            />
            {isAuthenticated && (
              <>
                <WishlistButtonClient spotId={spot.id} size="icon" />
                <FavoriteButtonClient spotId={spot.id} size="icon" />
                <CheckInButton spotId={spot.id} spotName={spot.name} variant="icon" />
              </>
            )}
          </div>
          {isAuthenticated ? (
            primaryAction && (
              <a
                href={primaryAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-[border-color] duration-[var(--duration-fast)] active:scale-[0.98]"
              >
                {primaryAction.label}
              </a>
            )
          ) : (
            // Shared-link viewer: replace the member toolbar buttons with
            // the two conversion CTAs. Sign-in preserves where they were
            // going via `?next=` so they land back on this spot page.
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/login?next=${encodeURIComponent(`/${spot.city.toLowerCase().replace(/ /g, "-")}/${spot.id}`)}`}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/apply"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-[border-color] duration-[var(--duration-fast)] active:scale-[0.98]"
              >
                Apply to join
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
