import { notFound } from "next/navigation";
import Link from "next/link";
import { getSpotById, getSpotsByCity, getAllSpotIds } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SpotGallery from "@/components/SpotGallery";
import SpotMap from "@/components/SpotMap";
import { Clock, CalendarDays, Shirt, Car, MapPin, ExternalLink, Phone, Globe, AtSign, Ticket, ChevronLeft } from "lucide-react";
import MobileBackButton from "@/components/MobileBackButton";

export async function generateStaticParams() {
  const ids = await getAllSpotIds();
  return ids.map((id) => ({ id }));
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-900 hover:underline">
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );

  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{label}</p>
        <p className="text-base text-neutral-700 dark:text-neutral-300 mt-0.5">{content}</p>
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

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto relative">
      <MobileBackButton />
      <SpotGallery images={spot.images} name={spot.name} />

      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-400 dark:text-neutral-500 pt-6 pb-4">
          <Link href="/miami" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
            Miami
          </Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-neutral-600 dark:text-neutral-400 dark:text-neutral-500">{spot.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{spot.name}</h1>
            <p className="text-base text-neutral-500 dark:text-neutral-400 mt-1.5">
              {CATEGORY_LABELS[spot.category]} · {spot.neighborhood}, {spot.city}
              {spot.priceRange && <span> · {spot.priceRange}</span>}
            </p>
          </div>
          {spot.bookingUrl && (
            <a
              href={spot.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center bg-brand-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
            >
              {spot.bookingPlatform === "Resy"
                ? "Reserve on Resy"
                : spot.bookingPlatform === "OpenTable"
                ? "Reserve on OpenTable"
                : spot.bookingPlatform === "SevenRooms"
                ? "Reserve"
                : spot.category === "hotels"
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

        <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />

        {/* About */}
        <div>
          <h2 className="text-lg font-medium mb-3">About</h2>
          <p className="text-base text-neutral-600 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">
            {spot.description}
          </p>
        </div>

        {/* Essential Info */}
        <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
        <div>
          <h2 className="text-lg font-medium mb-2">Essential info</h2>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {spot.hours && (
              <InfoRow
                icon={<Clock size={20} strokeWidth={1.5} />}
                label="Hours"
                value={spot.hours}
              />
            )}
            {spot.dressCode && (
              <InfoRow
                icon={<Shirt size={20} strokeWidth={1.5} />}
                label="Dress code"
                value={spot.dressCode}
              />
            )}
            {spot.parking && (
              <InfoRow
                icon={<Car size={20} strokeWidth={1.5} />}
                label="Parking"
                value={spot.parking}
              />
            )}
            <InfoRow
              icon={<MapPin size={20} strokeWidth={1.5} />}
              label="Address"
              value={spot.address}
            />
          </div>
        </div>

        {/* Menu */}
        {spot.menuUrl && (
          <>
            <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
            <div>
              <h2 className="text-lg font-medium mb-3">Menu</h2>
              <a
                href={spot.menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-900 hover:underline"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
                View menu
              </a>
            </div>
          </>
        )}

        {/* Events */}
        {spot.events && spot.events.length > 0 && (
          <>
            <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
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
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">
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

        {/* Contact & Links */}
        {(spot.phone || spot.website || spot.instagram) && (
          <>
            <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
            <div>
              <h2 className="text-lg font-medium mb-2">Contact & links</h2>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {spot.phone && (
                  <InfoRow
                    icon={<Phone size={20} strokeWidth={1.5} />}
                    label="Phone"
                    value={spot.phone}
                    href={`tel:${spot.phone}`}
                  />
                )}
                {spot.website && (
                  <InfoRow
                    icon={<Globe size={20} strokeWidth={1.5} />}
                    label="Website"
                    value={spot.website.replace(/^https?:\/\//, "")}
                    href={spot.website}
                  />
                )}
                {spot.instagram && (
                  <InfoRow
                    icon={<AtSign size={20} strokeWidth={1.5} />}
                    label="Instagram"
                    value={spot.instagram}
                    href={`https://instagram.com/${spot.instagram.replace("@", "")}`}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* Map */}
        <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
        <div>
          <h2 className="text-lg font-medium mb-4">Location</h2>
          <div className="rounded-xl overflow-hidden h-[300px]">
            <SpotMap lng={spot.lng} lat={spot.lat} name={spot.name} />
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-3">{spot.address}</p>
        </div>

        {/* Nearby */}
        {nearby.length > 0 && (
          <>
            <hr className="my-6 border-neutral-200 dark:border-neutral-800 dark:border-neutral-800" />
            <div>
              <h2 className="text-lg font-medium mb-4">
                More in {spot.neighborhood}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nearby.map((s) => (
                  <Link
                    key={s.id}
                    href={`/miami/${s.id}`}
                    className="group border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                  >
                    <h3 className="text-sm font-medium group-hover:text-neutral-900 dark:hover:text-white" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
                      {s.name}
                    </h3>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {CATEGORY_LABELS[s.category]}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
                      {s.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="h-12" />
      </div>
      </div>
    </div>
  );
}
