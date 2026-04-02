import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpotById, getSpotsByCity, getAllSpotIds } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SpotGallery from "@/components/SpotGallery";
import SpotLocationMap from "@/components/SpotLocationMap";
import ShareButton from "@/components/ShareButton";
import SaveButtonClient from "@/components/SaveButtonClient";
import CheckInButton from "@/components/CheckInButton";
import { Clock, Shirt, Car, MapPin, ExternalLink, Phone, Globe, AtSign } from "lucide-react";
import MobileBackButton from "@/components/MobileBackButton";
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

function HoursDisplay({ hours }: { hours: string }) {
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = await getSpotById(id);

  if (!spot) {
    notFound();
  }

  const allCitySpots = await getSpotsByCity(spot.city);
  const nearby = allCitySpots
    .filter((s) => s.neighborhood === spot.neighborhood && s.id !== spot.id)
    .slice(0, 3);

  const hasDetails = spot.hours || spot.dressCode || spot.parking || spot.phone || spot.website || spot.instagram || spot.menuUrl;

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
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto relative">
        <MobileBackButton />
        <GalleryReveal>
          <SpotGallery images={spot.images} name={spot.name} />
        </GalleryReveal>

        <div className="max-w-3xl mx-auto px-4 md:px-6">
          {/* Header */}
          <FadeIn delay={0.1}>
            <div className="pt-7 pb-2">
              <h1 className="text-[26px] font-semibold tracking-tight">{spot.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")} · {spot.neighborhood}, {spot.city}
                  {spot.priceRange && <span> · {spot.priceRange}</span>}
                </span>
                {spot.vibes && spot.vibes.length > 0 && (
                  <div className="flex gap-2">
                    {spot.vibes.map((vibe) => (
                      <span key={vibe} className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-stone-200/60 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400">
                        {vibe}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed mt-4">
                {spot.description}
              </p>
            </div>
          </FadeIn>

          {/* Details */}
          {hasDetails && (
            <SectionReveal>
              <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-xl font-semibold mb-4">Details</h2>

                {/* Hours — horizontal day layout */}
                {spot.hours && (
                  <div className="py-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={16} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">Hours</p>
                    </div>
                    <HoursDisplay hours={spot.hours} />
                  </div>
                )}

                {/* Detail items — 2-col grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0">
                  {spot.menuUrl && (
                    <InfoRow icon={<ExternalLink size={20} strokeWidth={1.5} />} label="Menu" value="View menu" href={spot.menuUrl} />
                  )}
                  {spot.website && (
                    <InfoRow icon={<Globe size={20} strokeWidth={1.5} />} label="Website" value={spot.website.replace(/^https?:\/\//, "")} href={spot.website} />
                  )}
                  {spot.dressCode && (
                    <InfoRow icon={<Shirt size={20} strokeWidth={1.5} />} label="Dress code" value={spot.dressCode} />
                  )}
                  {spot.instagram && (
                    <InfoRow icon={<AtSign size={20} strokeWidth={1.5} />} label="Instagram" value={spot.instagram} href={`https://instagram.com/${spot.instagram.replace("@", "")}`} />
                  )}
                  {spot.parking && (
                    <InfoRow icon={<Car size={20} strokeWidth={1.5} />} label="Parking" value={spot.parking} />
                  )}
                  {spot.phone && (
                    <InfoRow icon={<Phone size={20} strokeWidth={1.5} />} label="Phone" value={spot.phone} href={`tel:${spot.phone}`} />
                  )}
                </div>
              </div>
            </SectionReveal>
          )}

          {/* Events */}
          {spot.events && spot.events.length > 0 && (
            <SectionReveal>
              <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-xl font-semibold mb-5">Upcoming events</h2>
                <div className="space-y-3">
                  {spot.events.map((event, i) => {
                    const d = new Date(event.date);
                    return (
                      <div key={i} className="flex gap-4 p-4 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] font-medium uppercase text-neutral-400 dark:text-neutral-500 leading-none">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="text-lg font-semibold leading-tight">{d.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium">{event.name}</h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{event.description}</p>
                        </div>
                      </div>
                    );
                  })}
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
            <ShareButton spotName={spot.name} variant="icon" />
            <CheckInButton spotId={spot.id} variant="icon" />
            <SaveButtonClient spotId={spot.id} size="icon" />
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
