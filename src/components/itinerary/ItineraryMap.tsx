"use client";

// Map used by the itinerary planner and share-view. Shows:
//
//   1. The committed stops as numbered brand-colored pins joined by a
//      dashed polyline (same behavior as v1).
//   2. [v2, optional] A candidate dot layer — small translucent dots for
//      every spot matching the planner's criteria. These sit *beneath*
//      the numbered pins and dim further when any criteria are active.
//   3. [v2, optional] A suggestion dot layer — tinted, slightly larger
//      dots for the 3–5 "pairs well" recommendations, pulsing softly
//      to draw the eye.
//
// The three layers are independent: the candidate and suggestion layers
// are no-ops when their respective arrays are empty / absent, so the
// share view can keep its current single-layer look with zero changes.
//
// fitBounds runs on the committed stops only — candidates /
// suggestions shouldn't zoom the map out, otherwise picking a remote
// neighborhood as a criterion would yank the user away from their
// current focus.

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getCustomMapStyle } from "../mapStyle";
import { THEME } from "@/lib/theme";
import type { Category } from "@/lib/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const EASE_OUT_QUART = (t: number) => 1 - Math.pow(1 - t, 4);
const MIAMI_CENTER: [number, number] = [-80.1918, 25.7817];
const DEFAULT_ZOOM = 12;
const LINE_SOURCE_ID = "itinerary-line";
const LINE_LAYER_ID = "itinerary-line";

export interface ItineraryMapStop {
  spotId: string;
  name: string;
  lng: number;
  lat: number;
  position: number; // 0-indexed; UI renders position + 1
}

/** Candidate — a spot matching the planner's criteria but not yet in
 *  the plan. Rendered as a small translucent dot. */
export interface ItineraryMapCandidate {
  spotId: string;
  lng: number;
  lat: number;
  category?: Category;
}

/** Suggestion — a "pairs well" recommendation. Rendered slightly
 *  larger and pulsing. */
export interface ItineraryMapSuggestion {
  spotId: string;
  lng: number;
  lat: number;
}

interface Props {
  stops: ItineraryMapStop[];
  /** When set, that pin scales up + gets a brand-colored ring. Used by
   *  list-row hover in the planner. */
  highlightSpotId?: string | null;
  onPinClick?: (spotId: string) => void;
  /** v2 — candidate dots for criteria-matching spots. */
  candidates?: ItineraryMapCandidate[];
  /** v2 — promoted candidate dots ("pairs well"). Pulsing, brand-tinted. */
  suggestions?: ItineraryMapSuggestion[];
  /** v2 — click handler for both candidate and suggestion dots. */
  onCandidateClick?: (spotId: string) => void;
}

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function createPinElement(number: number): HTMLDivElement {
  // Wrapper is a 0×0 anchor so the pin centers precisely on the coord.
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "0";
  el.style.height = "0";
  el.style.cursor = "pointer";
  el.dataset.pin = "1";

  // Neutral, inverse-of-surface pin: dark on light map tiles in light
  // mode, light on dark tiles in dark mode. Stays readable without
  // leaning on the reserved brand color.
  const dark = isDarkMode();
  const pinBg = dark ? THEME.white : THEME.light.text;
  const pinFg = dark ? THEME.dark.surface : THEME.white;
  const pinBorder = dark ? THEME.dark.surface : THEME.white;

  const pin = document.createElement("div");
  pin.dataset.pinInner = "1";
  pin.style.position = "absolute";
  pin.style.top = "-16px";
  pin.style.left = "-16px";
  pin.style.width = "32px";
  pin.style.height = "32px";
  pin.style.borderRadius = "50%";
  pin.style.background = pinBg;
  pin.style.color = pinFg;
  pin.style.display = "flex";
  pin.style.alignItems = "center";
  pin.style.justifyContent = "center";
  pin.style.fontFamily = "var(--font-calibre), system-ui, sans-serif";
  pin.style.fontWeight = "700";
  pin.style.fontSize = "14px";
  pin.style.lineHeight = "1";
  pin.style.border = `2px solid ${pinBorder}`;
  pin.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
  pin.style.transition =
    "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease-out";
  pin.style.willChange = "transform";
  pin.textContent = String(number);
  el.appendChild(pin);
  return el;
}

function applyHighlight(el: HTMLDivElement, highlighted: boolean) {
  const inner = el.querySelector<HTMLDivElement>("[data-pin-inner]");
  if (!inner) return;
  if (highlighted) {
    inner.style.transform = "scale(1.18)";
    inner.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
    el.style.zIndex = "3";
  } else {
    inner.style.transform = "scale(1)";
    inner.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
    el.style.zIndex = "1";
  }
}

function setPinNumber(el: HTMLDivElement, number: number) {
  const inner = el.querySelector<HTMLDivElement>("[data-pin-inner]");
  if (inner) inner.textContent = String(number);
}

/** Tiny subdued dot — criteria match, not yet in plan. */
function createCandidateElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "0";
  el.style.height = "0";
  el.style.cursor = "pointer";
  el.dataset.candidate = "1";

  const dot = document.createElement("div");
  dot.style.position = "absolute";
  dot.style.top = "-6px";
  dot.style.left = "-6px";
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "50%";
  dot.style.background = "rgba(24,24,24,0.55)";
  dot.style.border = "1.5px solid rgba(255,255,255,0.9)";
  dot.style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
  dot.style.transition = "transform 160ms ease-out";
  el.appendChild(dot);

  el.addEventListener("mouseenter", () => {
    dot.style.transform = "scale(1.3)";
  });
  el.addEventListener("mouseleave", () => {
    dot.style.transform = "scale(1)";
  });
  return el;
}

/** Neutral, softly pulsing — "pairs well" recommendation. */
function createSuggestionElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "0";
  el.style.height = "0";
  el.style.cursor = "pointer";
  el.dataset.suggestion = "1";

  const dark = isDarkMode();
  const dotBg = dark ? THEME.white : THEME.light.text;
  const ringBg = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";

  const ring = document.createElement("div");
  ring.style.position = "absolute";
  ring.style.top = "-14px";
  ring.style.left = "-14px";
  ring.style.width = "28px";
  ring.style.height = "28px";
  ring.style.borderRadius = "50%";
  ring.style.background = ringBg;
  ring.style.animation = "ss-suggestion-pulse 1800ms ease-in-out infinite";
  el.appendChild(ring);

  const dot = document.createElement("div");
  dot.style.position = "absolute";
  dot.style.top = "-7px";
  dot.style.left = "-7px";
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "50%";
  dot.style.background = dotBg;
  dot.style.border = "2px solid rgba(255,255,255,0.95)";
  dot.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
  el.appendChild(dot);
  return el;
}

export default function ItineraryMap({
  stops,
  highlightSpotId = null,
  onPinClick,
  candidates = [],
  suggestions = [],
  onCandidateClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(
    new Map(),
  );
  const candidateMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const suggestionMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onPinClickRef = useRef(onPinClick);
  const onCandidateClickRef = useRef(onCandidateClick);
  const highlightRef = useRef(highlightSpotId);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  onPinClickRef.current = onPinClick;
  onCandidateClickRef.current = onCandidateClick;
  highlightRef.current = highlightSpotId;

  // Track dark mode so we can recreate the map style when it flips.
  useEffect(() => {
    setDark(isDarkMode());
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // Teardown when dark mode changes — then the init effect recreates.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current.clear();
      candidateMarkersRef.current.clear();
      suggestionMarkersRef.current.clear();
      setReady(false);
    }
  }, [dark]);

  // Initialize the map. StrictMode double-mount friendly: defer to rAF +
  // check `aborted` before wiring anything.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let aborted = false;
    let ro: ResizeObserver | null = null;

    const raf = requestAnimationFrame(() => {
      if (aborted || !containerRef.current) return;

      const m = new mapboxgl.Map({
        container: containerRef.current,
        style: getCustomMapStyle(dark),
        center: stops[0] ? [stops[0].lng, stops[0].lat] : MIAMI_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      });

      m.on("load", () => {
        if (aborted) return;
        // Dashed line source + layer (empty FeatureCollection to start).
        m.addSource(LINE_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: LINE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            // Neutral route line — inverse of surface so it's readable
            // on either map theme without reaching for the brand color.
            "line-color": dark ? THEME.white : THEME.light.text,
            "line-width": 2.5,
            "line-opacity": 0.7,
            "line-dasharray": [1.5, 2],
          },
        });
        setReady(true);
      });

      ro = new ResizeObserver(() => mapRef.current?.resize());
      ro.observe(containerRef.current);
      mapRef.current = m;
    });

    return () => {
      aborted = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      candidateMarkersRef.current.forEach((m) => m.remove());
      candidateMarkersRef.current.clear();
      suggestionMarkersRef.current.forEach((m) => m.remove());
      suggestionMarkersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Intentionally exclude `stops`: the init uses them once for center;
    // subsequent changes flow through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // Sync markers with `stops`: add new, update existing numbers, remove gone.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;

    const live = new Set(stops.map((s) => s.spotId));

    // Remove markers for stops that left.
    markersRef.current.forEach(({ marker }, id) => {
      if (!live.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add / update.
    for (const stop of stops) {
      const existing = markersRef.current.get(stop.spotId);
      const number = stop.position + 1;
      if (existing) {
        setPinNumber(existing.el, number);
        existing.marker.setLngLat([stop.lng, stop.lat]);
      } else {
        const el = createPinElement(number);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onPinClickRef.current?.(stop.spotId);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(m);
        markersRef.current.set(stop.spotId, { marker, el });
      }
      // Keep the highlight state applied after any number update.
      const entry = markersRef.current.get(stop.spotId);
      if (entry) applyHighlight(entry.el, highlightRef.current === stop.spotId);
    }

    // Update the dashed line source.
    const src = m.getSource(LINE_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features:
          stops.length >= 2
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: stops.map((s) => [s.lng, s.lat]),
                  },
                },
              ]
            : [],
      });
    }
  }, [stops, ready]);

  // Sync candidate markers. We also suppress a candidate whose spot is
  // already a committed stop or a suggestion so there's no visual
  // double-up.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const stopIds = new Set(stops.map((s) => s.spotId));
    const suggIds = new Set(suggestions.map((s) => s.spotId));
    const live = new Set<string>();
    for (const c of candidates) {
      if (stopIds.has(c.spotId) || suggIds.has(c.spotId)) continue;
      live.add(c.spotId);
      const existing = candidateMarkersRef.current.get(c.spotId);
      if (existing) {
        existing.setLngLat([c.lng, c.lat]);
      } else {
        const el = createCandidateElement();
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onCandidateClickRef.current?.(c.spotId);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([c.lng, c.lat])
          .addTo(m);
        candidateMarkersRef.current.set(c.spotId, marker);
      }
    }
    // Remove stale.
    candidateMarkersRef.current.forEach((marker, id) => {
      if (!live.has(id)) {
        marker.remove();
        candidateMarkersRef.current.delete(id);
      }
    });
  }, [candidates, stops, suggestions, ready]);

  // Sync suggestion markers. Suggestions beat candidates when a spot
  // appears in both (see candidate loop above), so we only need to
  // handle our own set here.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const stopIds = new Set(stops.map((s) => s.spotId));
    const live = new Set<string>();
    for (const s of suggestions) {
      if (stopIds.has(s.spotId)) continue;
      live.add(s.spotId);
      const existing = suggestionMarkersRef.current.get(s.spotId);
      if (existing) {
        existing.setLngLat([s.lng, s.lat]);
      } else {
        const el = createSuggestionElement();
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onCandidateClickRef.current?.(s.spotId);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([s.lng, s.lat])
          .addTo(m);
        suggestionMarkersRef.current.set(s.spotId, marker);
      }
    }
    suggestionMarkersRef.current.forEach((marker, id) => {
      if (!live.has(id)) {
        marker.remove();
        suggestionMarkersRef.current.delete(id);
      }
    });
  }, [suggestions, stops, ready]);

  // Refit to stops whenever the stop *set* changes (add/remove). We
  // intentionally don't refit on reorder (which doesn't change bounds)
  // to avoid distracting pan animations during drag.
  const stopSetKey = stops
    .map((s) => s.spotId)
    .sort()
    .join("|");
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    if (stops.length === 0) return;
    if (stops.length === 1) {
      m.easeTo({
        center: [stops[0].lng, stops[0].lat],
        zoom: 14,
        duration: 800,
        easing: EASE_OUT_QUART,
        essential: true,
      });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    const isNarrow =
      typeof window !== "undefined" && window.innerWidth < 640;
    const pad = isNarrow ? 48 : 96;
    m.fitBounds(bounds, {
      padding: { top: pad, bottom: pad, left: pad, right: pad },
      maxZoom: 15,
      duration: 900,
      easing: EASE_OUT_QUART,
      essential: true,
    });
    // stopSetKey captures identity-of-set; we don't want reorder to
    // trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSetKey, ready]);

  // Apply highlight changes imperatively (cheap — no marker recreation).
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach(({ el }, id) => {
      applyHighlight(el, highlightSpotId === id);
    });
  }, [highlightSpotId, ready]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <style jsx global>{`
        @keyframes ss-suggestion-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.55;
          }
          50% {
            transform: scale(1.35);
            opacity: 0.1;
          }
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          opacity: ready ? 1 : 0,
          transition: "opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
