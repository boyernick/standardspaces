"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

// Shared easing for every easeTo/fitBounds call so pan and zoom feel like one
// motion system. easeOutQuart starts a touch gentler than the old easeOutCubic
// (`1 - (1-t)^3`) and settles more softly — the difference is subtle at short
// durations but removes the "whip" feeling at longer (>=900ms) ones.
const EASE_OUT_QUART = (t: number) => 1 - Math.pow(1 - t, 4);

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
  /**
   * When set, force this spot's marker into the image-card style while the
   * user hovers the matching list row — without triggering a pan or showing
   * the click-driven overlay. Clearing it returns the marker to whatever the
   * normal card/dot mix would give it.
   */
  hoverSpotId?: string | null;
  /**
   * Ordered list of spot ids currently in the user's plan draft (first
   * stop at index 0). Markers whose ids appear here render a numbered
   * corner pin in the top-left of the image card, matching the plan-tray
   * list. Plan edits only toggle/retext the pin — they never rebuild the
   * marker. Pass an empty array (or omit) to render no pins.
   */
  planStopIds?: readonly string[];
  /**
   * Draw a dashed polyline connecting the `planStopIds` in order. Used by
   * the itinerary planner + share view to render the visual trail between
   * stops. No-op when fewer than 2 plan stops exist. Off by default —
   * city-browse surfaces don't want a route line.
   */
  showPlanRoute?: boolean;
  /**
   * Imperative fitBounds request. When the `focusBounds` value changes
   * to a non-null bounds, the map eases to fit that box. Used by the
   * itinerary planner to pan to a chosen neighborhood (or the
   * intersection of neighborhood + activity categories) without having
   * to filter out non-matching spots from the marker layer. Paired with
   * `focusBounds` tracked by reference identity — pass a fresh tuple
   * only when you mean to re-fit, otherwise the same-reference bail-out
   * keeps the effect from refitting on every render.
   */
  focusBounds?: LngLatBounds | null;
}

const PLAN_ROUTE_SOURCE_ID = "plan-route";
const PLAN_ROUTE_LAYER_ID = "plan-route";

export default function SpotMap(props: MapProps) {
  const { spots = [], activeSpot = null, onSpotSelect = () => {}, onViewChange, initialView, focusSpot = null, focusToken, hoverSpotId = null, planStopIds, showPlanRoute = false, focusBounds = null } = props ?? {};
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
  const hoverIdRef = useRef<string | null>(hoverSpotId);
  const didInitialFitRef = useRef(false);
  // Flipped on the first user drag / zoom gesture. Late-arriving
  // geolocation respects this so we never yank a deliberate pan.
  const userInteractedRef = useRef(false);
  spotsRef.current = spots;
  onSpotSelectRef.current = onSpotSelect;
  activeIdRef.current = activeSpot?.id ?? null;
  hoverIdRef.current = hoverSpotId;

  // Plan-index lookup for the numbered corner pin on card-mode markers.
  // Built from `planStopIds` — memoized so effect deps stay stable when
  // callers pass a fresh array of the same ids. Stored in a ref too so
  // the marker-creation path can read the current index synchronously
  // without waiting for the plan-sync effect to flush.
  const planIndexById = useMemo<globalThis.Map<string, number>>(
    () => new globalThis.Map((planStopIds ?? []).map((id, i) => [id, i])),
    [planStopIds],
  );
  const planIndexByIdRef = useRef(planIndexById);
  planIndexByIdRef.current = planIndexById;

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
    // `img` fills its wrapper at 100%/100% — resize the wrapper so the
    // plan-pin overlay anchored to its top-left corner scales with it.
    const imgWrap = el.querySelector("[data-img-wrap]") as HTMLDivElement | null;
    const img = el.querySelector("[data-img]") as HTMLDivElement | null;
    if (!imgWrap || !img) return;
    if (active) {
      imgWrap.style.width = "52px";
      imgWrap.style.height = "52px";
      img.style.borderRadius = "16px";
      img.style.borderColor = THEME.brand;
      img.style.borderWidth = "3px";
      el.style.zIndex = "3";
    } else {
      imgWrap.style.width = "42px";
      imgWrap.style.height = "42px";
      img.style.borderRadius = "14px";
      img.style.borderColor = dark ? THEME.dark.surface : THEME.light.surface;
      img.style.borderWidth = "3px";
      // Restore zIndex appropriate for current mode.
      el.style.zIndex = entry.mode === "card" ? "1" : "0";
    }
  }, [applyMarkerMode, dark]);

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
    // Hovered list-card spot should always render as an image card too.
    if (hoverIdRef.current) cardSet.add(hoverIdRef.current);
    // Plan members are always rendered as image cards regardless of
    // zoom budget — a plan is a visual trail the user is building, and
    // demoting stops to 8-px dots at lower zooms erases that trail.
    planIndexByIdRef.current.forEach((_, id) => cardSet.add(id));
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

        // Plan-route source + layer. Always mounted (empty
        // FeatureCollection by default) so the route-sync effect can just
        // `setData` without racing style load; the line only renders when
        // we push ≥2 coordinates and `showPlanRoute` is on.
        m.addSource(PLAN_ROUTE_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: PLAN_ROUTE_LAYER_ID,
          type: "line",
          source: PLAN_ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            // Neutral — inverse of surface so it reads on either theme
            // without reaching for the brand color.
            "line-color": dark ? THEME.white : THEME.light.text,
            "line-width": 2.5,
            "line-opacity": 0.7,
            "line-dasharray": [1.5, 2],
          },
        });

        // Track manual pan/zoom so late-arriving geolocation doesn't
        // override a deliberate view. `dragstart` / `zoomstart` fire for
        // both user gestures and programmatic `easeTo` calls, so we
        // filter for `originalEvent` — only user-initiated events carry
        // a DOM event; our own animations don't.
        const markInteracted = (e: unknown) => {
          const originalEvent = (e as { originalEvent?: Event } | undefined)?.originalEvent;
          if (originalEvent) userInteractedRef.current = true;
        };
        m.on("dragstart", markInteracted);
        m.on("zoomstart", markInteracted);

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
    // Intentionally excludes `userLocation`: the map no longer re-inits
    // when location arrives — a dedicated `easeTo` effect (below) pans
    // to it instead. Tearing the map down on every location update was
    // wiping the in-progress initial fit and leaving prod users stranded
    // on the city-wide view even after they granted the permission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

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

    // Decide initial card/dot mode for this render based on current view.
    // Plan members always get card mode so they stay visible as image
    // cards at any zoom — mirrors the `recomputeModes` behavior applied
    // on every pan/zoom and plan change.
    const center = m.getCenter();
    const budget = computeBudget(m.getZoom());
    const cardSet = computeCardSet(spots, [center.lng, center.lat], budget, activeId);
    planIndexByIdRef.current.forEach((_, id) => cardSet.add(id));

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
      card.style.top = "-21px"; // shift up by image half-height so image center sits on the anchor
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.alignItems = "center";
      card.style.transformOrigin = "50% 21px"; // scale around the image center
      card.style.transition = TRANSITION;
      card.style.willChange = "opacity, transform";
      card.style.opacity = initialMode === "card" ? "1" : "0";
      card.style.transform = initialMode === "card"
        ? "translateX(-50%) scale(1)"
        : "translateX(-50%) scale(0.7)";
      card.style.pointerEvents = initialMode === "card" ? "auto" : "none";

      // imgWrap owns the sized box and serves as the positioning context
      // for the plan-pin overlay. img fills it at 100%/100% so sizing
      // transitions run on the wrapper and the pin at -6px/-6px tracks
      // the corner even when the image grows (active) or shrinks.
      const imgWrap = document.createElement("div");
      imgWrap.dataset.imgWrap = "1";
      imgWrap.style.position = "relative";
      imgWrap.style.width = "42px";
      imgWrap.style.height = "42px";
      imgWrap.style.transition = "width 0.2s, height 0.2s";
      imgWrap.style.willChange = "width, height";

      const img = document.createElement("div");
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "14px";
      img.style.overflow = "hidden";
      img.style.border = `3px solid ${dark ? THEME.dark.surface : THEME.light.surface}`;
      img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      img.style.transition = "border-radius 0.2s, border-color 0.2s";
      img.style.backgroundSize = "cover";
      img.style.backgroundPosition = "center";
      img.style.backgroundColor = dark ? "#2A2922" : "#e5e5e0";
      if (s.images?.[0]) {
        img.style.backgroundImage = `url(${s.images[0]})`;
      }
      img.dataset.img = "1";
      imgWrap.appendChild(img);

      // Plan pin — always mounted, hidden until this spot enters the
      // draft plan. Styling mirrors the corner badge on the itinerary
      // tray's stop rows so the two surfaces read as one vocabulary.
      // The surface-colored ring (via boxShadow) lets the pin separate
      // from the image when it overhangs the border.
      const planPin = document.createElement("div");
      planPin.dataset.planPin = "1";
      planPin.style.position = "absolute";
      planPin.style.top = "-6px";
      planPin.style.left = "-6px";
      planPin.style.width = "20px";
      planPin.style.height = "20px";
      planPin.style.borderRadius = "9999px";
      planPin.style.display = "none";
      planPin.style.alignItems = "center";
      planPin.style.justifyContent = "center";
      planPin.style.fontSize = "11px";
      planPin.style.fontWeight = "700";
      planPin.style.fontFamily = "var(--font-calibre), system-ui, sans-serif";
      planPin.style.backgroundColor = dark ? "#ffffff" : "#111111";
      planPin.style.color = dark ? "#111111" : "#ffffff";
      planPin.style.boxShadow = `0 0 0 2px ${dark ? THEME.dark.surface : THEME.light.surface}`;
      planPin.style.pointerEvents = "none";
      planPin.style.zIndex = "2";
      const initialPlanIdx = planIndexByIdRef.current.get(s.id);
      if (initialPlanIdx != null) {
        planPin.style.display = "flex";
        planPin.textContent = String(initialPlanIdx + 1);
      }
      imgWrap.appendChild(planPin);

      card.appendChild(imgWrap);

      const label = document.createElement("div");
      label.textContent = s.name;
      label.style.fontSize = "10px";
      label.style.fontWeight = "500";
      label.style.color = dark ? "#ededed" : "#1a1a1a";
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
      label.style.backgroundColor = dark ? "#13120A" : "#F7F7F3";
      label.style.boxShadow = dark
        ? "0 2px 6px rgba(0,0,0,0.45)"
        : "0 2px 6px rgba(0,0,0,0.12)";
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

  // Upgrade a hovered list-card spot to the image-card marker without panning
  // the map. Always recompute so the previously-hovered marker reverts to
  // its natural mode (dot) when the hover moves to a different card.
  useEffect(() => {
    if (!mapReady) return;
    recomputeModes();
  }, [hoverSpotId, mapReady, recomputeModes]);

  // Sync plan-pin overlays + force card mode for plan members whenever
  // the plan changes. Toggles each marker's pin visibility, updates its
  // number, then recomputes the card/dot mix so newly-added stops pop
  // up as image cards and removed stops fall back to dots (if they're
  // outside the zoom budget). Markers that don't exist yet pick up
  // their pin state at creation via `planIndexByIdRef`.
  useEffect(() => {
    if (!mapReady) return;
    markers.current.forEach((entry, id) => {
      const pin = entry.el.querySelector("[data-plan-pin]") as HTMLDivElement | null;
      if (!pin) return;
      const idx = planIndexById.get(id);
      if (idx == null) {
        pin.style.display = "none";
        pin.textContent = "";
      } else {
        pin.style.display = "flex";
        pin.textContent = String(idx + 1);
      }
    });
    recomputeModes();
  }, [planIndexById, mapReady, recomputeModes]);

  // Sync the plan route line. Resolves each plan stop id to its spot
  // coords (via the passed `spots` array) and writes a LineString into
  // the source added at load time. When `showPlanRoute` is false or the
  // plan has fewer than 2 valid stops, we push an empty FeatureCollection
  // so any prior line is cleared without rebuilding the layer.
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const src = map.current.getSource(PLAN_ROUTE_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!src) return;

    if (!showPlanRoute || !planStopIds || planStopIds.length < 2) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const spotById = new globalThis.Map(spots.map((s) => [s.id, s]));
    const coords: [number, number][] = [];
    for (const id of planStopIds) {
      const s = spotById.get(id);
      if (s) coords.push([s.lng, s.lat]);
    }
    if (coords.length < 2) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      ],
    });
  }, [planStopIds, spots, showPlanRoute, mapReady]);

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
      // First-time centering: prefer user location, otherwise fit all spots.
      // A bit longer than subsequent fits so the page-load motion reads as a
      // graceful settle rather than a snap.
      if (userLocation) {
        map.current.easeTo({
          center: userLocation,
          zoom: 15,
          duration: 1500,
          easing: EASE_OUT_QUART,
          essential: true,
        });
      } else if (spots.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        spots.forEach((s) => bounds.extend([s.lng, s.lat]));
        map.current.fitBounds(bounds, {
          padding: { top: fitPad, bottom: fitPad, left: fitPad, right: fitPad },
          maxZoom: 15,
          duration: 1500,
          easing: EASE_OUT_QUART,
          essential: true,
        });
      } else {
        map.current.easeTo({
          center: MIAMI_CENTER,
          zoom: MIAMI_ZOOM,
          duration: 1500,
          easing: EASE_OUT_QUART,
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
      duration: 900,
      easing: EASE_OUT_QUART,
      essential: true,
    });
    // userLocation is deliberately omitted from the dep array: the initial
    // fit branch reads it once (gated by `!didInitialFitRef`); the
    // subsequent-update branch only cares about spots. Including it would
    // cause late-arriving geolocation (see below) to fire this effect and
    // refit to spots instead of centering on the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, mapReady, geoResolved]);

  // Late-arriving geolocation. In production the permission prompt
  // frequently resolves AFTER the 6s `geoResolved` fallback, at which
  // point the initial fit has already flown to a city-wide `fitBounds`.
  // When userLocation finally populates, pan to it — but only if the
  // member hasn't manually panned/zoomed in the meantime.
  useEffect(() => {
    if (!map.current || !mapReady || !userLocation) return;
    if (!didInitialFitRef.current) return;
    if (userInteractedRef.current) return;
    map.current.easeTo({
      center: userLocation,
      zoom: 15,
      duration: 1200,
      easing: EASE_OUT_QUART,
      essential: true,
    });
  }, [userLocation, mapReady]);

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
        easing: EASE_OUT_QUART,
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
      easing: EASE_OUT_QUART,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, mapReady]);

  // Imperative fitBounds triggered by `focusBounds` identity changes.
  // Caller is expected to pass a fresh tuple only when they mean to
  // re-fit (e.g. the itinerary planner when the user picks a
  // neighborhood). Same tuple identity on subsequent renders → no-op.
  useEffect(() => {
    if (!map.current || !mapReady || !focusBounds) return;
    const [[swLng, swLat], [neLng, neLat]] = focusBounds;
    // Guard against degenerate or inverted boxes; mapbox throws on those.
    if (
      !Number.isFinite(swLng) ||
      !Number.isFinite(swLat) ||
      !Number.isFinite(neLng) ||
      !Number.isFinite(neLat) ||
      swLng > neLng ||
      swLat > neLat
    ) {
      return;
    }
    const isNarrow =
      typeof window !== "undefined" && window.innerWidth < 640;
    const pad = isNarrow ? 32 : 80;
    // Single-point bounds (e.g. one spot in the neighborhood) — easeTo
    // that coordinate so we don't ask fitBounds to fit a 0-area box.
    if (swLng === neLng && swLat === neLat) {
      map.current.easeTo({
        center: [swLng, swLat],
        zoom: Math.max(map.current.getZoom(), 14),
        duration: 900,
        easing: EASE_OUT_QUART,
        essential: true,
      });
      return;
    }
    map.current.fitBounds(focusBounds, {
      padding: { top: pad, bottom: pad, left: pad, right: pad },
      maxZoom: 15,
      duration: 900,
      easing: EASE_OUT_QUART,
      essential: true,
    });
  }, [focusBounds, mapReady]);

  const handleRecenter = useCallback(() => {
    const m = map.current;
    if (!m) return;

    const flyTo = (lng: number, lat: number) => {
      m.easeTo({
        center: [lng, lat],
        zoom: Math.max(m.getZoom(), 15),
        duration: 900,
        easing: EASE_OUT_QUART,
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
          easing: EASE_OUT_QUART,
          essential: true,
        });
      } else {
        m.easeTo({
          center: MIAMI_CENTER,
          zoom: MIAMI_ZOOM,
          duration: 900,
          easing: EASE_OUT_QUART,
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

  // Rapid-click chaining: when the user taps +/− faster than the animation
  // completes, accumulate against the *target* zoom instead of the current
  // zoom. Otherwise each click restarts an ease-out from the partially-eased
  // position and the motion feels stuttery.
  const zoomTargetRef = useRef<number | null>(null);
  const zoomBy = useCallback((delta: number) => {
    const m = map.current;
    if (!m) return;
    const base = zoomTargetRef.current ?? m.getZoom();
    // Clamp to mapbox's supported range so rapid clicks don't push past the
    // limits and cause the ease to snap.
    const next = Math.max(m.getMinZoom(), Math.min(m.getMaxZoom(), base + delta));
    zoomTargetRef.current = next;
    m.easeTo({
      zoom: next,
      duration: 520,
      // Slightly longer than the old 400ms so discrete taps don't feel like
      // a jump — the extra ~120ms gives the settle room to read without
      // feeling laggy on rapid presses (zoomTargetRef still accumulates).
      easing: EASE_OUT_QUART,
      essential: true,
    });
    const clear = () => {
      zoomTargetRef.current = null;
      m.off("moveend", clear);
    };
    m.on("moveend", clear);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Fade the canvas in once the Mapbox instance fires `load`, so tiles
          aren't visible to the user while the initial fitBounds/easeTo is
          still flying them into place. Without this the map pops in at the
          default zoom and snaps to the target, which reads as a stutter. */}
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          opacity: mapReady ? 1 : 0,
          transition: "opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
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
