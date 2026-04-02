import { notFound } from "next/navigation";
import Link from "next/link";
import { getSpotById, getSpotsByCity, getAllSpotIds } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SpotGallery from "@/components/SpotGallery";
import SpotMap from "@/components/SpotMap";
import ImageCarousel from "@/components/ImageCarousel";
import { Clock, Shirt, Car, MapPin, ExternalLink, Phone, Globe, AtSign } from "lucide-react";
import MobileBackButton from "@/components/MobileBackButton";
import SpotActions from "@/components/SpotActions";

export async function generateStaticParams() {
  const ids = await getAllSpotIds();
  return ids.map((id) => ({ id }));
}

function HoursDisplay({ hours }: { hours: string }) {
  // Parse "Mon 7AM–11AM, 12AM–4PM · Tue 7AM–11AM" or "Daily 11AM–11PM" format
  const lines: { day: string; times: string }[] = [];

  // Check for simple "Daily X–Y" format
  const dailyMatch = hours.match(/^Daily\s+(.+)$/i);
  if (dailyMatch) {
    return <span className="text-sm text-neutral-700 dark:text-neutral-300">{hours}</span>;
  }

  // Split by day abbreviations
  const dayPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g;
  const parts = hours.split(dayPattern).filter(Boolean);

  for (let i = 0; i < parts.length - 1; i += 2) {
    const day = parts[i].trim();
    let times = parts[i + 1].replace(/^[,\s·]+/, "").replace(/[,\s·]+$/, "").trim();
    // Clean up separators between time blocks
    times = times.replace(/,\s*/g, ", ");
    if (day && times) {
      lines.push({ day, times });
    }
  }

  if (lines.length === 0) {
    return <span className="text-sm text-neutral-700 dark:text-neutral-300">{hours}</span>;
  }

  // Check if all days have the same hours
  const allSame = lines.length === 7 && lines.every((l) => l.times === lines[0].times);
  if (allSame) {
    return <span className="text-sm text-neutral-700 dark:text-neutral-300">Daily {lines[0].times}</span>;
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {lines.map(({ day, times }) => (
        <div key={day} className="contents text-sm">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">{day}</span>
          <span className="text-neutral-700 dark:text-neutral-300">{times}</span>
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
    <div className="flex items-start gap-3 py-3">
      <div className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{label}</p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{content}</p>
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
    .slice(0, 4);

  const hasContact = spot.phone || spot.website || spot.instagram;
  const hasInfo = spot.hours || spot.dressCode || spot.parking;

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto relative">
        <MobileBackButton />
        <SpotGallery images={spot.images} name={spot.name} />

        <div className="max-w-3xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pt-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{spot.name}</h1>
              <p className="text-base text-neutral-500 dark:text-neutral-400 mt-1.5">
                {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")} · {spot.neighborhood}, {spot.city}
                {spot.priceRange && <span> · {spot.priceRange}</span>}
              </p>
            </div>
            {spot.bookingUrl && (
              <a
                href={spot.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex shrink-0 items-center bg-brand-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
              >
                {spot.bookingPlatform === "Resy"
                  ? "Reserve on Resy"
                  : spot.bookingPlatform === "OpenTable"
                  ? "Reserve on OpenTable"
                  : spot.bookingPlatform === "SevenRooms"
                  ? "Reserve"
                  : spot.category.includes("hotels")
                  ? "Book a stay"
                  : "Book now"}
              </a>
            )}
          </div>

          {/* Vibes */}
          {spot.vibes && spot.vibes.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide">
              {spot.vibes.map((vibe) => (
                <span key={vibe} className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {vibe}
                </span>
              ))}
            </div>
          )}

          <hr className="my-6 border-neutral-200 dark:border-neutral-800" />

          {/* About */}
          <div>
            <h2 className="text-lg font-medium mb-3">About</h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {spot.description}
            </p>
          </div>

          {/* Essential Info + Contact — combined two-column grid */}
          {(hasInfo || hasContact || spot.menuUrl) && (
            <>
              <hr className="my-6 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-medium mb-2">Details</h2>
                {/* Hours — full width above the grid */}
                {spot.hours && (
                  <div className="flex items-start gap-3 py-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500"><Clock size={20} strokeWidth={1.5} /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">Hours</p>
                      <div className="mt-0.5"><HoursDisplay hours={spot.hours} /></div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {spot.dressCode && (
                      <InfoRow icon={<Shirt size={20} strokeWidth={1.5} />} label="Dress code" value={spot.dressCode} />
                    )}
                    {spot.parking && (
                      <InfoRow icon={<Car size={20} strokeWidth={1.5} />} label="Parking" value={spot.parking} />
                    )}
                    <InfoRow icon={<MapPin size={20} strokeWidth={1.5} />} label="Address" value={spot.address} />
                  </div>
                  {(hasContact || spot.menuUrl) && (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {spot.website && (
                        <InfoRow icon={<Globe size={20} strokeWidth={1.5} />} label="Website" value={spot.website.replace(/^https?:\/\//, "")} href={spot.website} />
                      )}
                      {spot.instagram && (
                        <InfoRow icon={<AtSign size={20} strokeWidth={1.5} />} label="Instagram" value={spot.instagram} href={`https://instagram.com/${spot.instagram.replace("@", "")}`} />
                      )}
                      {spot.menuUrl && (
                        <InfoRow icon={<ExternalLink size={20} strokeWidth={1.5} />} label="Menu" value="View menu" href={spot.menuUrl} />
                      )}
                      {spot.phone && (
                        <InfoRow icon={<Phone size={20} strokeWidth={1.5} />} label="Phone" value={spot.phone} href={`tel:${spot.phone}`} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Events */}
          {spot.events && spot.events.length > 0 && (
            <>
              <hr className="my-6 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-medium mb-4">Upcoming events</h2>
                <div className="space-y-3">
                  {spot.events.map((event, i) => (
                    <div key={i} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
                            {event.name}
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            {event.description}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap shrink-0">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Map */}
          <hr className="my-6 border-neutral-200 dark:border-neutral-800" />
          <div>
            <h2 className="text-lg font-medium mb-4">Location</h2>
            <div className="rounded-xl overflow-hidden h-[300px]">
              <SpotMap lng={spot.lng} lat={spot.lat} name={spot.name} />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">{spot.address}</p>
          </div>

          {/* Nearby — with thumbnails */}
          {nearby.length > 0 && (
            <>
              <hr className="my-6 border-neutral-200 dark:border-neutral-800" />
              <div>
                <h2 className="text-lg font-medium mb-4">
                  More in {spot.neighborhood}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nearby.map((s) => (
                    <Link
                      key={s.id}
                      href={`/miami/${s.id}`}
                      className="group overflow-hidden border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                    >
                      {s.images.length > 0 && (
                        <div className="aspect-[16/9] overflow-hidden">
                          <img
                            src={s.images[0]}
                            alt={s.name}
                            loading="lazy"
                            className="w-full h-full object-cover spot-img group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </div>
                      )}
                      <div className="p-3.5">
                        <h3 className="text-sm font-medium group-hover:text-neutral-900 dark:group-hover:text-white" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
                          {s.name}
                        </h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {s.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className={spot.bookingUrl ? "h-36 md:h-20" : "h-24 md:h-12"} />
        </div>
      </div>

      <SpotActions spotId={id} hasBookingBar={!!spot.bookingUrl} />

      {/* Sticky mobile booking button */}
      {spot.bookingUrl && (
        <div className="md:hidden sticky bottom-0 z-30 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href={spot.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-brand-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            {spot.bookingPlatform === "Resy"
              ? "Reserve on Resy"
              : spot.bookingPlatform === "OpenTable"
              ? "Reserve on OpenTable"
              : spot.bookingPlatform === "SevenRooms"
              ? "Reserve"
              : spot.category.includes("hotels")
              ? "Book a stay"
              : "Book now"}
          </a>
        </div>
      )}
    </div>
  );
}
