"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Spot } from "@/lib/types";
import { THEME } from "@/lib/theme";
import { getCustomMapStyle } from "./mapStyle";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MIAMI_CENTER: [number, number] = [-80.1918, 25.7817];
const MIAMI_ZOOM = 12;

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

interface MapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSpotSelect: (spot: Spot | null) => void;
}

export default function Map({ spots, activeSpot, onSpotSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [dark, setDark] = useState(false);
  const spotsRef = useRef(spots);
  const onSpotSelectRef = useRef(onSpotSelect);
  spotsRef.current = spots;
  onSpotSelectRef.current = onSpotSelect;

  const updateMarkerStyle = useCallback((id: string, active: boolean) => {
    const entry = markers.current.get(id);
    if (!entry) return;
    const { el } = entry;
    if (active) {
      el.style.width = "40px";
      el.style.height = "40px";
      el.style.borderColor = THEME.brand;
      el.style.borderWidth = "2.5px";
      el.style.zIndex = "3";
    } else {
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderColor = THEME.white;
      el.style.borderWidth = "2px";
      el.style.zIndex = "1";
    }
  }, []);

  // Track dark mode
  useEffect(() => {
    setDark(isDarkMode());
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Recreate map when dark mode changes
  useEffect(() => {
    if (map.current) {
      map.current.remove();
      map.current = null;
      markers.current.clear();
      setMapReady(false);
    }
  }, [dark]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: getCustomMapStyle(dark),
      center: MIAMI_CENTER,
      zoom: MIAMI_ZOOM,
      attributionControl: false,
    });

    m.on("load", () => {
      // Click on empty map area deselects
      m.on("click", () => {
        onSpotSelectRef.current(null);
      });

      setMapReady(true);
    });

    map.current = m;

    const ro = new ResizeObserver(() => {
      map.current?.resize();
    });
    if (mapContainer.current) ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      markers.current.forEach(({ marker }) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, [dark]);

  // Sync markers with spots
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;
    const activeId = activeSpot?.id ?? null;

    // Remove markers for spots no longer in the list
    const currentIds = new Set(spots.map((s) => s.id));
    markers.current.forEach(({ marker }, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });

    // Add/update markers
    spots.forEach((s) => {
      const existing = markers.current.get(s.id);
      if (existing) {
        // Update active state
        updateMarkerStyle(s.id, s.id === activeId);
        return;
      }

      // Create new marker element
      const el = document.createElement("div");
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "6px";
      el.style.overflow = "hidden";
      el.style.border = `2px solid ${THEME.white}`;
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      el.style.cursor = "pointer";
      el.style.transition = "width 0.2s, height 0.2s, border-color 0.2s";
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.backgroundColor = dark ? "#2A2922" : "#e5e5e0";

      if (s.images?.[0]) {
        el.style.backgroundImage = `url(${s.images[0]})`;
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSpotSelectRef.current(s);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([s.lng, s.lat])
        .addTo(m);

      markers.current.set(s.id, { marker, el });
      updateMarkerStyle(s.id, s.id === activeId);
    });
  }, [spots, activeSpot, mapReady, dark, updateMarkerStyle]);

  // Fit bounds when spots change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (spots.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      spots.forEach((s) => bounds.extend([s.lng, s.lat]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 15,
        duration: 1200,
        essential: true,
      });
    } else {
      map.current.easeTo({
        center: MIAMI_CENTER,
        zoom: MIAMI_ZOOM,
        duration: 1200,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    }
  }, [spots, mapReady]);

  // Pan to active spot if off-screen
  useEffect(() => {
    if (!map.current || !mapReady || !activeSpot) return;

    const m = map.current;
    const point = m.project([activeSpot.lng, activeSpot.lat]);
    const canvas = m.getCanvas();
    const padding = 80;

    const isOutside =
      point.x < padding ||
      point.x > canvas.width - padding ||
      point.y < padding ||
      point.y > canvas.height - padding;

    if (isOutside) {
      m.easeTo({
        center: [activeSpot.lng, activeSpot.lat],
        zoom: Math.max(m.getZoom(), 13),
        duration: 1000,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    }
  }, [activeSpot, mapReady]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
