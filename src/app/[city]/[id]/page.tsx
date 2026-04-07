import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpotById, getSpotsByCity, getAllSpotIds } from "@/lib/data";
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
import { Clock, Shirt, Car, MapPin, Newspaper, Smartphone, Globe, AtSign, CalendarCheck } from "lucide-react";
import { FadeIn, GalleryReveal, SectionReveal } from "@/components/ListingAnimations";

export async function generateStaticParams() {
  const ids = await getAllSpotIds();
  return ids.map((id) => ({ id }));
}

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
  const now = new Date();
  const today = ALL_DAYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Parse hours into day map
  const compact = getCompactHours(hours);
  let todayTimes: string | null = null;

  // Try "Daily X" format
  const dailyMatch = hours.match(/^Daily\s+(.+)$/i);
  if (dailyMatch) todayTimes = dailyMatch[1].trim();

  // Try range/individual format
  if (!todayTimes) {
    const ALL_DAYS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const lines: { day: string; times: string }[] = [];
    const rangeMatch = hours.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[-–]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(.+)$/i);
    if (rangeMatch) {
      const startIdx = ALL_DAYS_FULL.indexOf(rangeMatch[1]);
      const endIdx = ALL_DAYS_FULL.indexOf(rangeMatch[2]);
      const times = rangeMatch[3].trim();
      if (startIdx >= 0 && endIdx >= 0) {
        let i = startIdx;
        while (true) {
          lines.push({ day: ALL_DAYS_FULL[i], times });
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
        if (day && times) lines.push({ day, times });
      }
    }
    const dayMap = new Map(lines.map((l) => [l.day, l.times]));
    todayTimes = dayMap.get(today) ?? null;
  }

  if (!todayTimes || todayTimes.toLowerCase() === "closed") {
    // Find next opening
    return compact ? `Closed · ${compact}` : "Closed";
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

  const parts = todayTimes.split(/[-–]/);
  if (parts.length === 2) {
    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    if (open !== null && close !== null) {
      const closeStr = parts[1].trim();
      // Handle overnight (e.g., 6PM-2AM)
      const openStr = parts[0].trim();
      const isOvernight = close <= open;
      if (isOvernight) {
        if (currentMinutes >= open || currentMinutes < close) {
          return `Open now · Closes at ${closeStr}`;
        } else {
          return `Closed · Opens at ${openStr}`;
        }
      } else {
        if (currentMinutes >= open && currentMinutes < close) {
          return `Open now · Closes at ${closeStr}`;
        } else if (currentMinutes < open) {
          return `Closed · Opens at ${openStr}`;
        } else {
          return `Closed · Opens at ${openStr}`;
        }
      }
    }
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

  const [allCitySpots, spotEvents] = await Promise.all([
    getSpotsByCity(spot.city),
    getVisibleEventsForSpot(spot.id),
  ]);
  const nearby = allCitySpots
    .filter((s) => s.neighborhood === spot.neighborhood && s.id !== spot.id)
    .slice(0, 3);
  const spotNamesMap = { [spot.id]: spot.name };

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

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <Navbar />
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
              <h1 className="text-[26px] font-semibold tracking-tight">{spot.name}</h1>
              <p className="text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {spot.description}
              </p>
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
              spotInstagram={spot.instagram}
            />
            <CheckInButton spotId={spot.id} variant="icon" />
            <WishlistButtonClient spotId={spot.id} size="icon" />
            <FavoriteButtonClient spotId={spot.id} size="icon" />
          </div>
          {spot.bookingUrl && (
            <a
              href={spot.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto px-6 py-2.5 text-center bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
