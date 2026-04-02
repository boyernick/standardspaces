"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { CATEGORY_LABELS, Category } from "@/lib/types";
import { getCustomMapStyle } from "./mapStyle";

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
      el.style.background = THEME.brand;
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

      {/* Map */}
      <div className="relative">
        <div ref={container} className="w-full h-[350px] rounded-2xl overflow-hidden" />

        {/* Hover card from map dot */}
        {hoveredFromMap && (
          <Link
            href={`/miami/${hoveredFromMap.id}`}
            className="absolute bottom-3 right-3 z-10 w-56 bg-surface rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
          >
            {hoveredFromMap.images.length > 0 && (
              <div className="h-24 overflow-hidden">
                <img src={hoveredFromMap.images[0]} alt={hoveredFromMap.name} className="w-full h-full object-cover spot-img" />
              </div>
            )}
            <div className="p-2.5">
              <p className="text-sm font-medium truncate">{hoveredFromMap.name}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                {hoveredFromMap.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Address below map */}
      <div className="mt-4">
        <p className="text-[15px] font-medium">{spot.neighborhood}, {spot.name.split("|")[0].trim()}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{address}</p>
      </div>

      {/* Nearby */}
      {nearby.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">More places nearby</h3>
          <div className="grid grid-cols-3 gap-4">
            {nearby.slice(0, 3).map((s) => (
              <Link
                key={s.id}
                href={`/miami/${s.id}`}
                className="group rounded-xl overflow-hidden transition-all"
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {s.images.length > 0 && (
                  <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={s.images[0]}
                      alt={s.name}
                      loading="lazy"
                      className="w-full h-full object-cover spot-img group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="pt-2.5">
                  <h4 className="text-sm font-medium truncate">{s.name}</h4>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
