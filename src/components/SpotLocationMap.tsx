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
    const img = el.querySelector("[data-img]") as HTMLDivElement | null;
    if (!img) return;
    if (active) {
      img.style.width = "40px";
      img.style.height = "40px";
      img.style.borderColor = THEME.brand;
      el.style.zIndex = "3";
    } else {
      img.style.width = "30px";
      img.style.height = "30px";
      img.style.borderColor = THEME.white;
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

    const m = new mapboxgl.Map({
      container: container.current,
      style: getCustomMapStyle(dark),
      center: [spot.lng, spot.lat],
      zoom: 15,
      // Static map — no pan/zoom/rotate. Marker hover still works because
      // those handlers live on the marker DOM elements, not the map canvas.
      interactive: false,
      attributionControl: false,
    });

    function buildMarker(s: SpotInfo, isMain: boolean): HTMLDivElement {
      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.cursor = "pointer";
      el.style.zIndex = isMain ? "2" : "1";

      const img = document.createElement("div");
      const size = isMain ? "40px" : "30px";
      img.style.width = size;
      img.style.height = size;
      img.style.borderRadius = "6px";
      img.style.overflow = "hidden";
      img.style.border = `3px solid ${isMain ? THEME.brand : dark ? THEME.dark.surface : THEME.light.surface}`;
      img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      img.style.transition = "width 0.2s, height 0.2s, border-color 0.2s";
      img.style.backgroundSize = "cover";
      img.style.backgroundPosition = "center";
      img.style.backgroundColor = dark ? "#2A2922" : "#e5e5e0";
      if (s.images?.[0]) {
        img.style.backgroundImage = `url(${s.images[0]})`;
      }
      img.dataset.img = "1";
      el.appendChild(img);

      const label = document.createElement("div");
      label.textContent = s.name;
      label.style.fontSize = "10px";
      label.style.fontWeight = "500";
      label.style.color = "#1a1a1a";
      label.style.marginTop = "4px";
      label.style.whiteSpace = "nowrap";
      label.style.maxWidth = "80px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.textAlign = "center";
      label.style.fontFamily = "var(--font-calibre), system-ui, sans-serif";
      // Pill container: light surface bg + soft shadow so the name reads
      // against the map tiles.
      label.style.padding = "2px 6px";
      label.style.borderRadius = "9999px";
      label.style.backgroundColor = "#F7F7F3";
      label.style.boxShadow = dark
        ? "0 2px 6px rgba(0,0,0,0.45)"
        : "0 2px 6px rgba(0,0,0,0.12)";
      el.appendChild(label);

      return el;
    }

    // Main spot marker (highlighted)
    const mainEl = buildMarker(spot, true);
    new mapboxgl.Marker({ element: mainEl, anchor: "center" })
      .setLngLat([spot.lng, spot.lat])
      .addTo(m);

    // Nearby markers
    for (const s of nearby) {
      const el = buildMarker(s, false);

      el.addEventListener("mouseenter", () => {
        setHoveredId(s.id);
        setHoveredFromMap(s);
      });
      el.addEventListener("mouseleave", () => {
        setHoveredId(null);
        setHoveredFromMap(null);
      });

      markerEls.current.set(s.id, el);
      new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([s.lng, s.lat])
        .addTo(m);
    }

    map.current = m;

    return () => {
      markerEls.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [spot, nearby, setMarkerActive]);

  // Only display the street portion of the address — strip city/state/zip/
  // country. The full address is still passed to Google Maps for routing,
  // since trimming it would degrade the directions accuracy.
  const streetAddress = address.split(",")[0].trim();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Where you&apos;ll find it</h2>

      {/* Directions */}
      <div className="mb-4">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
        >
          <MapPin size={14} strokeWidth={1.5} />
          {streetAddress}
          {spot.neighborhood && (
            <>
              <span className="text-neutral-300 dark:text-neutral-600">·</span>
              <span>{spot.neighborhood}</span>
            </>
          )}
        </a>
      </div>

      {/* Map */}
      <div className="relative">
        <div
          ref={container}
          // `touch-action: pan-y` lets a vertical page scroll pass through
          // the static map on mobile — otherwise a finger-drag that starts
          // on the map gets eaten by Mapbox's internal gesture handling
          // and the page appears stuck.
          className="w-full h-[350px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 touch-pan-y"
        />

        {/* Hover card from map dot */}
        {hoveredFromMap && (
          <Link
            href={`/${citySlug}/${hoveredFromMap.id}`}
            className="absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-72 z-10 bg-surface rounded-3xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
          >
            <div className="flex gap-3 p-3">
              {hoveredFromMap.images.length > 0 && (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
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
          <h3
            className="text-lg font-medium text-neutral-900 dark:text-white mb-4"
            style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
          >
            More spaces nearby
          </h3>
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
                    <h3 className="text-sm font-semibold line-clamp-1">{s.name}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                      {s.neighborhood} · {s.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                    </p>
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
