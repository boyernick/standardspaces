"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { THEME } from "@/lib/theme";
import { CATEGORY_LABELS, Category } from "@/lib/types";
import { getCustomMapStyle } from "./mapStyle";
import ImageCarousel from "./ImageCarousel";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface SpotInfo {
  id: string;
  name: string;
  category: Category[];
  neighborhood: string;
  images: string[];
  lng: number;
  lat: number;
}

interface SpotLocationMapProps {
  spot: SpotInfo;
  nearby: SpotInfo[];
  address: string;
}

export default function SpotLocationMap({ spot, nearby, address }: SpotLocationMapProps) {
  const pathname = usePathname();
  const citySlug = pathname.split("/")[1] || "miami";
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredFromMap, setHoveredFromMap] = useState<SpotInfo | null>(null);

  const setMarkerActive = useCallback((id: string, active: boolean) => {
    const el = markerEls.current.get(id);
    if (!el) return;
    const dark = document.documentElement.classList.contains("dark");
    if (active) {
      el.style.background = "#015C07";
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.zIndex = "3";
    } else {
      el.style.background = dark ? THEME.light.surface : THEME.dark.surface;
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.zIndex = "1";
    }
  }, []);

  // When hoveredId changes from card hover, update map markers
  useEffect(() => {
    markerEls.current.forEach((_, id) => {
      setMarkerActive(id, id === hoveredId);
    });
  }, [hoveredId, setMarkerActive]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const dark = document.documentElement.classList.contains("dark");

    const allSpots = [spot, ...nearby];
    const bounds = new mapboxgl.LngLatBounds();
    allSpots.forEach((s) => bounds.extend([s.lng, s.lat]));

    const m = new mapboxgl.Map({
      container: container.current,
      style: getCustomMapStyle(dark),
      center: [spot.lng, spot.lat],
      zoom: 15,
      interactive: true,
      attributionControl: false,
    });

    if (nearby.length > 0) {
      m.on("load", () => {
        m.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 16,
          duration: 0,
        });
      });
    }

    // Main spot marker
    const mainEl = document.createElement("div");
    mainEl.style.cssText = `
      width: 16px; height: 16px;
      background: ${THEME.brand};
      border-radius: 50%;
      border: 2.5px solid ${THEME.white};
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 2;
    `;
    new mapboxgl.Marker(mainEl).setLngLat([spot.lng, spot.lat]).addTo(m);

    // Nearby markers
    for (const s of nearby) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 12px; height: 12px;
        background: ${dark ? THEME.light.surface : THEME.dark.surface};
        border-radius: 50%;
        border: 2px solid ${THEME.white};
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        cursor: pointer;
        transition: all 0.15s ease;
        z-index: 1;
      `;

      el.addEventListener("mouseenter", () => {
        setHoveredId(s.id);
        setHoveredFromMap(s);
      });
      el.addEventListener("mouseleave", () => {
        setHoveredId(null);
        setHoveredFromMap(null);
      });

      markerEls.current.set(s.id, el);
      new mapboxgl.Marker(el).setLngLat([s.lng, s.lat]).addTo(m);
    }

    map.current = m;

    return () => {
      markerEls.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [spot, nearby, setMarkerActive]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Where you&apos;ll find it</h2>

      {/* Directions */}
      <div className="mb-4">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
        >
          <MapPin size={14} strokeWidth={1.5} />
          {address}
        </a>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={container} className="w-full h-[350px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800" />

        {/* Hover card from map dot */}
        {hoveredFromMap && (
          <Link
            href={`/${citySlug}/${hoveredFromMap.id}`}
            className="absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-72 z-10 bg-surface rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
          >
            <div className="flex gap-3 p-3">
              {hoveredFromMap.images.length > 0 && (
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                  <img src={hoveredFromMap.images[0]} alt={hoveredFromMap.name} className="w-full h-full object-cover spot-img" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-sm font-medium truncate">{hoveredFromMap.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {hoveredFromMap.neighborhood} · {hoveredFromMap.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Nearby */}
      {nearby.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-4">More Nearby</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {nearby.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="group block rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <Link href={`/${citySlug}/${s.id}`} className="block">
                  <ImageCarousel
                    images={s.images}
                    alt={s.name}
                    aspectClassName="aspect-[16/10]"
                    roundedClassName="rounded-2xl"
                  />
                  <div className="p-3 rounded-b-2xl bg-surface">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold line-clamp-1">{s.name}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{s.neighborhood}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {s.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
