"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { LocateFixed, Plus, Minus } from "lucide-react";
import { Spot } from "@/lib/types";
import { THEME } from "@/lib/theme";
import { getCustomMapStyle } from "./mapStyle";
import { squaredDistance, type LngLat, type LngLatBounds } from "@/lib/geo";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MIAMI_CENTER: [number, number] = [-80.1918, 25.7817];
const MIAMI_ZOOM = 12;

type MarkerMode = "card" | "dot";

function computeBudget(zoom: number): number {
  if (zoom <= 15) return 0;
  if (zoom < 17) return 4;
  if (zoom < 18) return 8;
  return Infinity;
}

function computeCardSet(
  spots: Spot[],
  center: [number, number],
  budget: number,
  activeId: string | null,
): Set<string> {
  if (budget === Infinity) return new Set(spots.map((s) => s.id));
  if (budget <= 0) return new Set(activeId ? [activeId] : []);
  const ranked = spots
    .map((s) => ({ id: s.id, d: squaredDistance([s.lng, s.lat], center) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, budget)
    .map((r) => r.id);
  const set = new Set(ranked);
  if (activeId) set.add(activeId);
  return set;
}

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export interface MapView {
  center: LngLat;
  bounds: LngLatBounds;
  zoom: number;
}

interface MapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSpotSelect: (spot: Spot | null) => void;
  /**
   * Fires once on initial load and on every `moveend`. Carries the full
   * viewport (center, bounds, zoom) so consumers can scope a list to it.
   */
  onViewChange?: (v: MapView) => void;
  /**
   * When provided, the map jumps directly to this center+zoom on init and
   * skips the default fitBounds behavior. Used to hydrate the viewport from
   * a shareable URL without flashing through fitBounds first.
   */
  initialView?: { center: LngLat; zoom: number };
  /**
   * Imperative pan request. When `focusToken` changes to a new value, the
   * map eases to `focusSpot`'s coordinates. Use this to force a pan (e.g.
   * from "Nearby" card hover) without relying on the activeSpot isOutside
   * heuristic.
   */
  focusSpot?: Spot | null;
  focusToken?: number;
}

export default function SpotMap(props: MapProps) {
  const { spots = [], activeSpot = null, onSpotSelect = () => {}, onViewChange, initialView, focusSpot = null, focusToken } = props ?? {};
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  // Latch the initialView at first render so later prop changes (e.g. after
  // a router.replace from URL sync) don't re-jump the map.
  const initialViewRef = useRef(initialView);
  if (initialViewRef.current === undefined && initialView) {
    initialViewRef.current = initialView;
  }
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<globalThis.Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; mode: MarkerMode }>>(new globalThis.Map());
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);
  const spotsRef = useRef(spots);
  const onSpotSelectRef = useRef(onSpotSelect);
  const activeIdRef = useRef<string | null>(activeSpot?.id ?? null);
  const didInitialFitRef = useRef(false);
  spotsRef.current = spots;
  onSpotSelectRef.current = onSpotSelect;
  activeIdRef.current = activeSpot?.id ?? null;

  // Request user location. Cache in sessionStorage so a sign-out/sign-in
  // remount doesn't re-prompt or re-fetch.
  useEffect(() => {
    if (!navigator.geolocation) { setGeoResolved(true); return; }

    // Use cached location if it's fresh (< 10 minutes old)
    try {
      const raw = sessionStorage.getItem("userLocation");
      if (raw) {
        const parsed = JSON.parse(raw) as { lng: number; lat: number; ts: number };
        if (Date.now() - parsed.ts < 10 * 60 * 1000) {
          setUserLocation([parsed.lng, parsed.lat]);
          setGeoResolved(true);
          return;
        }
      }
    } catch {}

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setUserLocation([lng, lat]);
        setGeoResolved(true);
        try {
          sessionStorage.setItem("userLocation", JSON.stringify({ lng, lat, ts: Date.now() }));
        } catch {}
      },
      () => { setGeoResolved(true); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
    // Fallback timeout in case geolocation hangs
    const t = setTimeout(() => setGeoResolved(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const applyMarkerMode = useCallback((id: string, mode: MarkerMode) => {
    const entry = markers.current.get(id);
    if (!entry) return;
    const card = entry.el.querySelector("[data-card]") as HTMLDivElement | null;
    const dot = entry.el.querySelector("[data-dot]") as HTMLDivElement | null;
    if (!card || !dot) return;
    if (mode === "card") {
      card.style.opacity = "1";
      card.style.transform = "translateX(-50%) scale(1)";
      card.style.pointerEvents = "auto";
      dot.style.opacity = "0";
      dot.style.transform = "translate(-50%, -50%) scale(0.7)";
      dot.style.pointerEvents = "none";
      entry.el.style.zIndex = "1";
    } else {
      card.style.opacity = "0";
      card.style.transform = "translateX(-50%) scale(0.7)";
      card.style.pointerEvents = "none";
      dot.style.opacity = "1";
      dot.style.transform = "translate(-50%, -50%) scale(1)";
      dot.style.pointerEvents = "auto";
      entry.el.style.zIndex = "0";
    }
    entry.mode = mode;
  }, []);

  const updateMarkerStyle = useCallback((id: string, active: boolean) => {
    const entry = markers.current.get(id);
    if (!entry) return;
    const { el } = entry;
    // Active markers are always shown as cards.
    if (active && entry.mode !== "card") {
      applyMarkerMode(id, "card");
    }
    const img = el.querySelector("[data-img]") as HTMLDivElement | null;
    if (!img) return;
    if (active) {
      img.style.width = "46px";
      img.style.height = "46px";
      img.style.borderRadius = "14px";
      img.style.borderColor = THEME.brand;
      img.style.borderWidth = "3px";
      el.style.zIndex = "3";
    } else {
      img.style.width = "36px";
      img.style.height = "36px";
      img.style.borderRadius = "12px";
      img.style.borderColor = THEME.white;
      img.style.borderWidth = "3px";
      // Restore zIndex appropriate for current mode.
      el.style.zIndex = entry.mode === "card" ? "1" : "0";
    }
  }, [applyMarkerMode]);

  const recomputeModes = useCallback(() => {
    const m = map.current;
    if (!m || markers.current.size === 0) return;
    const zoom = m.getZoom();
    const center = m.getCenter();
    const budget = computeBudget(zoom);
    const cardSet = computeCardSet(
      spotsRef.current,
      [center.lng, center.lat],
      budget,
      activeIdRef.current,
    );
    markers.current.forEach((entry, id) => {
      const next: MarkerMode = cardSet.has(id) ? "card" : "dot";
      if (entry.mode !== next) applyMarkerMode(id, next);
    });
  }, [applyMarkerMode]);

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

    // Defer creation by a microtask so React StrictMode's double-mount cleanup
    // can abort init before mapbox queues internal style.load callbacks. This
    // sidesteps a known mapbox-gl 3.x bug where a deferred handler dereferences
    // `_style` after `remove()` and throws "Cannot read properties of undefined
    // (reading 'isIndoorEnabled')".
    let aborted = false;
    let m: mapboxgl.Map | null = null;
    let ro: ResizeObserver | null = null;

    const init = () => {
      if (aborted || !mapContainer.current) return;
      const hydrated = initialViewRef.current;
      m = new mapboxgl.Map({
        container: mapContainer.current,
        style: getCustomMapStyle(dark),
        center: hydrated?.center ?? userLocation ?? MIAMI_CENTER,
        zoom: hydrated?.zoom ?? (userLocation ? 15 : MIAMI_ZOOM),
        attributionControl: false,
      });
      // If we hydrated from a URL viewport, mark fitBounds as already done so
      // the fit effect below doesn't blow our restored view away.
      if (hydrated) didInitialFitRef.current = true;

      m.on("load", () => {
        if (aborted || !m) return;
        // Click on empty map area deselects
        m.on("click", () => {
          onSpotSelectRef.current(null);
        });

        // Build a {center, bounds, zoom} snapshot from the current map state.
        // `getBounds()` can return null mid-init in mapbox 3.x — bail in that
        // case so consumers never see a half-formed view.
        const snapshot = (): MapView | null => {
          if (!m) return null;
          const b = m.getBounds();
          if (!b) return null;
          const c = m.getCenter();
          return {
            center: [c.lng, c.lat],
            bounds: [
              [b.getWest(), b.getSouth()],
              [b.getEast(), b.getNorth()],
            ],
            zoom: m.getZoom(),
          };
        };

        // Recompute card/dot mix on every pan or zoom
        m.on("moveend", () => {
          recomputeModes();
          const s = snapshot();
          if (s) onViewChangeRef.current?.(s);
        });

        // Emit initial view so consumers can sort/scope to it on first paint.
        const initS = snapshot();
        if (initS) onViewChangeRef.current?.(initS);

        setMapReady(true);
      });

      map.current = m;

      ro = new ResizeObserver(() => {
        map.current?.resize();
      });
      if (mapContainer.current) ro.observe(mapContainer.current);
    };

    const raf = requestAnimationFrame(init);

    return () => {
      aborted = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
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

    // Wrapper holds both the pulse ring and the dot. The ring sits behind
    // the dot and scales outward so the halo clearly emanates past the dot.
    const el = document.createElement("div");
    el.style.position = "relative";
    el.style.width = "22px";
    el.style.height = "22px";
    el.style.zIndex = "10";

    const ring = document.createElement("div");
    ring.className = "user-location-pulse";

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.top = "50%";
    dot.style.left = "50%";
    dot.style.width = "16px";
    dot.style.height = "16px";
    dot.style.marginTop = "-8px";
    dot.style.marginLeft = "-8px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = "#FD5304";
    dot.style.border = "3px solid white";
    dot.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    dot.style.zIndex = "2";

    el.appendChild(ring);
    el.appendChild(dot);

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

    // Decide initial card/dot mode for this render based on current view
    const center = m.getCenter();
    const budget = computeBudget(m.getZoom());
    const cardSet = computeCardSet(spots, [center.lng, center.lat], budget, activeId);

    // Compute offsets so no two markers (cards or dots) sit at the same point.
    // Existing markers seed `placed` so newly-added markers respect their positions.
    const OFFSET = 0.0003; // ~30 meters
    const placed: Array<{ lng: number; lat: number }> = [];
    markers.current.forEach(({ marker }) => {
      const ll = marker.getLngLat();
      placed.push({ lng: ll.lng, lat: ll.lat });
    });
    function getOffset(lng: number, lat: number): [number, number] {
      let candidateLng = lng;
      let candidateLat = lat;
      let attempt = 0;
      // Keep spiraling outward until the candidate doesn't collide with any placed point.
      while (
        placed.some(
          (p) =>
            Math.abs(p.lng - candidateLng) < OFFSET &&
            Math.abs(p.lat - candidateLat) < OFFSET,
        )
      ) {
        const angle = attempt * 2.4; // golden angle
        const r = OFFSET * (1 + Math.floor(attempt / 6));
        candidateLng = lng + r * Math.cos(angle);
        candidateLat = lat + r * Math.sin(angle);
        attempt++;
        if (attempt > 64) break; // safety
      }
      return [candidateLng, candidateLat];
    }

    // Add/update markers
    spots.forEach((s) => {
      const existing = markers.current.get(s.id);
      if (existing) {
        // Update mode for this render, then refresh active state
        const nextMode: MarkerMode = cardSet.has(s.id) ? "card" : "dot";
        if (existing.mode !== nextMode) applyMarkerMode(s.id, nextMode);
        updateMarkerStyle(s.id, s.id === activeId);
        return;
      }

      const initialMode: MarkerMode = cardSet.has(s.id) ? "card" : "dot";

      // Wrapper element is a 0×0 anchor; card & dot are absolutely positioned
      // children that cross-fade between modes.
      const el = document.createElement("div");
      el.style.cursor = "pointer";
      el.style.position = "relative";
      el.style.width = "0";
      el.style.height = "0";

      const TRANSITION = "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";

      // ----- Card branch (image + label) -----
      const card = document.createElement("div");
      card.dataset.card = "1";
      card.style.position = "absolute";
      card.style.left = "0";
      card.style.top = "-18px"; // shift up by image half-height so image center sits on the anchor
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.alignItems = "center";
      card.style.transformOrigin = "50% 18px"; // scale around the image center
      card.style.transition = TRANSITION;
      card.style.willChange = "opacity, transform";
      card.style.opacity = initialMode === "card" ? "1" : "0";
      card.style.transform = initialMode === "card"
        ? "translateX(-50%) scale(1)"
        : "translateX(-50%) scale(0.7)";
      card.style.pointerEvents = initialMode === "card" ? "auto" : "none";

      const img = document.createElement("div");
      img.style.width = "36px";
      img.style.height = "36px";
      img.style.borderRadius = "12px";
      img.style.overflow = "hidden";
      img.style.border = `3px solid ${THEME.white}`;
      img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      img.style.transition = "width 0.2s, height 0.2s, border-radius 0.2s, border-color 0.2s";
      img.style.backgroundSize = "cover";
      img.style.backgroundPosition = "center";
      img.style.backgroundColor = dark ? "#2A2922" : "#e5e5e0";
      if (s.images?.[0]) {
        img.style.backgroundImage = `url(${s.images[0]})`;
      }
      img.dataset.img = "1";
      card.appendChild(img);

      const label = document.createElement("div");
      label.textContent = s.name;
      label.style.fontSize = "10px";
      label.style.fontWeight = "500";
      label.style.color = dark ? "#ededed" : "#1a1a1a";
      label.style.marginTop = "2px";
      label.style.whiteSpace = "nowrap";
      label.style.maxWidth = "70px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.textAlign = "center";
      label.style.fontFamily = "var(--font-calibre), system-ui, sans-serif";
      card.appendChild(label);

      el.appendChild(card);

      // ----- Dot branch -----
      const dot = document.createElement("div");
      dot.dataset.dot = "1";
      dot.style.position = "absolute";
      dot.style.left = "0";
      dot.style.top = "0";
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      // Light mode: light fill, dark border. Dark mode: inverted.
      dot.style.backgroundColor = dark ? "#1a1a1a" : "#ededed";
      dot.style.border = "1.5px solid " + (dark ? "#ededed" : "#1a1a1a");
      dot.style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
      dot.style.transformOrigin = "center center";
      dot.style.transition = TRANSITION;
      dot.style.willChange = "opacity, transform";
      dot.style.opacity = initialMode === "dot" ? "1" : "0";
      dot.style.transform = initialMode === "dot"
        ? "translate(-50%, -50%) scale(1)"
        : "translate(-50%, -50%) scale(0.7)";
      dot.style.pointerEvents = initialMode === "dot" ? "auto" : "none";
      el.appendChild(dot);

      el.style.zIndex = initialMode === "card" ? "1" : "0";

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSpotSelectRef.current(s);
      });

      // Apply spiral offset to every marker (cards and dots) so no two stack.
      const [offsetLng, offsetLat] = getOffset(s.lng, s.lat);
      placed.push({ lng: offsetLng, lat: offsetLat });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([offsetLng, offsetLat])
        .addTo(m);

      markers.current.set(s.id, { marker, el, mode: initialMode });
      updateMarkerStyle(s.id, s.id === activeId);
    });
  }, [spots, activeSpot, mapReady, dark, updateMarkerStyle, applyMarkerMode]);

  // When activeSpot changes (including deselect), re-evaluate card/dot mix so
  // the previously-active marker can fall back to a dot if appropriate.
  useEffect(() => {
    if (!mapReady) return;
    recomputeModes();
  }, [activeSpot, mapReady, recomputeModes]);

  // Fit bounds — wait for geolocation to resolve before deciding
  useEffect(() => {
    if (!map.current || !mapReady || !geoResolved) return;

    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true;
      // Responsive padding — a flat 80px eats 40% of a ~400px mobile viewport
      // and forces fitBounds to pick a much-too-far-out zoom.
      const isNarrow =
        typeof window !== "undefined" && window.innerWidth < 640;
      const fitPad = isNarrow ? 32 : 80;
      // First-time centering: prefer user location, otherwise fit all spots
      if (userLocation) {
        map.current.easeTo({
          center: userLocation,
          zoom: 15,
          duration: 1200,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      } else if (spots.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        spots.forEach((s) => bounds.extend([s.lng, s.lat]));
        map.current.fitBounds(bounds, {
          padding: { top: fitPad, bottom: fitPad, left: fitPad, right: fitPad },
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
      return;
    }

    // Subsequent updates (filter changes): always refit to the new spots so
    // the map reflects the filter, even when user location is known.
    if (spots.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    spots.forEach((s) => bounds.extend([s.lng, s.lat]));
    const isNarrow = typeof window !== "undefined" && window.innerWidth < 640;
    const fitPad = isNarrow ? 32 : 80;
    map.current.fitBounds(bounds, {
      padding: { top: fitPad, bottom: fitPad, left: fitPad, right: fitPad },
      maxZoom: 15,
      duration: 800,
      essential: true,
    });
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

  // Imperative pan triggered by focusToken bumps. Always eases regardless of
  // whether the spot is currently in the viewport — used by the "Nearby
  // spaces" fallback cards so hovering reliably pans the map.
  useEffect(() => {
    if (!map.current || !mapReady || !focusSpot || focusToken == null) return;
    map.current.easeTo({
      center: [focusSpot.lng, focusSpot.lat],
      zoom: Math.max(map.current.getZoom(), 14),
      duration: 900,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, mapReady]);

  const handleRecenter = useCallback(() => {
    const m = map.current;
    if (!m) return;

    const flyTo = (lng: number, lat: number) => {
      m.easeTo({
        center: [lng, lat],
        zoom: Math.max(m.getZoom(), 15),
        duration: 900,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    };

    // Reset the map to the initial spots-fit view (or city default if no
    // spots). Used when location is unavailable/denied so the center button
    // still has an obvious effect.
    const resetToInitial = () => {
      const isNarrow = typeof window !== "undefined" && window.innerWidth < 640;
      const fitPad = isNarrow ? 32 : 80;
      if (spots.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        spots.forEach((s) => bounds.extend([s.lng, s.lat]));
        m.fitBounds(bounds, {
          padding: { top: fitPad, bottom: fitPad, left: fitPad, right: fitPad },
          maxZoom: 15,
          duration: 900,
          essential: true,
        });
      } else {
        m.easeTo({
          center: MIAMI_CENTER,
          zoom: MIAMI_ZOOM,
          duration: 900,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      }
    };

    if (userLocation) {
      flyTo(userLocation[0], userLocation[1]);
      return;
    }
    if (!navigator.geolocation) {
      resetToInitial();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setUserLocation([lng, lat]);
        setGeoResolved(true);
        try {
          sessionStorage.setItem("userLocation", JSON.stringify({ lng, lat, ts: Date.now() }));
        } catch {}
        flyTo(lng, lat);
      },
      // Denied, timed out, or otherwise failed — reset to the default view.
      () => {
        resetToInitial();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [userLocation, spots]);

  const zoomBy = useCallback((delta: number) => {
    const m = map.current;
    if (!m) return;
    m.easeTo({
      zoom: m.getZoom() + delta,
      duration: 250,
      essential: true,
    });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Center on my location"
          className="w-8 h-8 rounded-[10px] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-center hover:bg-white/70 dark:hover:bg-neutral-900/70 transition-colors"
        >
          <LocateFixed size={14} strokeWidth={1.75} className="text-neutral-900 dark:text-white" />
        </button>
        <div className="w-8 rounded-[10px] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col items-center overflow-hidden">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label="Zoom in"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/70 dark:hover:bg-neutral-900/70 transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} className="text-neutral-900 dark:text-white" />
          </button>
          <div className="h-px w-full bg-neutral-300 dark:bg-neutral-600" />
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label="Zoom out"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/70 dark:hover:bg-neutral-900/70 transition-colors"
          >
            <Minus size={14} strokeWidth={1.75} className="text-neutral-900 dark:text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
