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

export default function SpotMap(props: MapProps) {
  const { spots = [], activeSpot = null, onSpotSelect = () => {} } = props ?? {};
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<globalThis.Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new globalThis.Map());
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const spotsRef = useRef(spots);
  const onSpotSelectRef = useRef(onSpotSelect);
  spotsRef.current = spots;
  onSpotSelectRef.current = onSpotSelect;

  // Request user location
  useEffect(() => {
    if (!navigator.geolocation) { setGeoResolved(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLocation([pos.coords.longitude, pos.coords.latitude]); setGeoResolved(true); },
      () => { setGeoResolved(true); },
      { enableHighAccuracy: false, timeout: 5000 }
    );
    // Fallback timeout in case geolocation hangs
    const t = setTimeout(() => setGeoResolved(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const updateMarkerStyle = useCallback((id: string, active: boolean) => {
    const entry = markers.current.get(id);
    if (!entry) return;
    const { el } = entry;
    const img = el.querySelector("[data-img]") as HTMLDivElement | null;
    if (!img) return;
    if (active) {
      img.style.width = "32px";
      img.style.height = "32px";
      img.style.borderColor = THEME.brand;
      img.style.borderWidth = "3px";
      el.style.zIndex = "3";
    } else {
      img.style.width = "24px";
      img.style.height = "24px";
      img.style.borderColor = THEME.white;
      img.style.borderWidth = "3px";
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
      center: userLocation ?? MIAMI_CENTER,
      zoom: userLocation ? 14 : MIAMI_ZOOM,
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
      userMarker.current?.remove();
      userMarker.current = null;
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, [dark, userLocation]);

  // Add/update user location marker
  useEffect(() => {
    if (!map.current || !mapReady || !userLocation) return;

    // Remove existing user marker
    if (userMarker.current) {
      userMarker.current.remove();
      userMarker.current = null;
    }

    const el = document.createElement("div");
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.borderRadius = "50%";
    el.style.backgroundColor = "#2563EB";
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.25), 0 2px 6px rgba(0,0,0,0.2)";

    userMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(userLocation)
      .addTo(map.current);
  }, [userLocation, mapReady, dark]);

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

      // Create new marker element: wrapper with image + label
      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.cursor = "pointer";

      const img = document.createElement("div");
      img.style.width = "24px";
      img.style.height = "24px";
      img.style.borderRadius = "5px";
      img.style.overflow = "hidden";
      img.style.border = `3px solid ${THEME.white}`;
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
      label.style.fontSize = "9px";
      label.style.fontWeight = "500";
      label.style.color = dark ? "#ededed" : "#1a1a1a";
      label.style.marginTop = "2px";
      label.style.whiteSpace = "nowrap";
      label.style.maxWidth = "60px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.textAlign = "center";
      label.style.fontFamily = "var(--font-calibre), system-ui, sans-serif";
      el.appendChild(label);

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

  // Fit bounds — wait for geolocation to resolve before deciding
  useEffect(() => {
    if (!map.current || !mapReady || !geoResolved) return;

    if (userLocation) {
      // User location available: center on their neighborhood
      map.current.easeTo({
        center: userLocation,
        zoom: 14,
        duration: 1200,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    } else if (spots.length > 0) {
      // No user location: fit all spots
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
  }, [spots, mapReady, geoResolved, userLocation]);

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
