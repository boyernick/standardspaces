"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Spot } from "@/lib/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MIAMI_CENTER: [number, number] = [-80.1918, 25.7817];
const MIAMI_ZOOM = 12;
const SOURCE_ID = "spots-source";
const LAYER_ID = "spots-layer";

function getMapStyle() {
  if (typeof window === "undefined") return "mapbox://styles/mapbox/streets-v12";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "mapbox://styles/mapbox/dark-v12"
    : "mapbox://styles/mapbox/streets-v12";
}

function isDarkMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

interface MapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSpotSelect: (spot: Spot | null) => void;
}

function toGeoJSON(spots: Spot[], activeId: string | null): GeoJSON.FeatureCollection {
  const sorted = [...spots].sort((a, b) => {
    if (a.id === activeId) return 1;
    if (b.id === activeId) return -1;
    return 0;
  });

  return {
    type: "FeatureCollection",
    features: sorted.map((s) => ({
      type: "Feature" as const,
      properties: {
        id: s.id,
        active: s.id === activeId ? 1 : 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [s.lng, s.lat],
      },
    })),
  };
}

export default function Map({ spots, activeSpot, onSpotSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const dark = isDarkMode();

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: MIAMI_CENTER,
      zoom: MIAMI_ZOOM,
      attributionControl: false,
    });

    m.on("load", () => {
      m.addSource(SOURCE_ID, {
        type: "geojson",
        data: toGeoJSON(spotsRef.current, null),
      });

      m.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        layout: {
          "circle-sort-key": ["get", "active"],
        },
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "active"], 1],
            8,
            6,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "active"], 1],
            "#e90042",
            dark ? "#ffffff" : "#1a1a1a",
          ],
          "circle-stroke-color": dark ? "#000000" : "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 1,
          "circle-radius-transition": { duration: 200 },
          "circle-color-transition": { duration: 200 },
        },
      });

      m.on("mouseenter", LAYER_ID, () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", LAYER_ID, () => {
        m.getCanvas().style.cursor = "";
      });

      m.on("click", LAYER_ID, (e) => {
        e.originalEvent.stopPropagation();
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          const spot = spotsRef.current.find(
            (s) => s.id === feature.properties!.id
          );
          if (spot) onSpotSelect(spot);
        }
      });

      m.on("click", (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
        if (!features.length) {
          onSpotSelect(null);
        }
      });

      setMapReady(true);
    });

    map.current = m;

    return () => {
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, [onSpotSelect]);

  useEffect(() => {
    if (!map.current || !mapReady) return;

    const source = map.current.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(toGeoJSON(spots, activeSpot?.id ?? null));
    }
  }, [spots, activeSpot, mapReady]);

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
