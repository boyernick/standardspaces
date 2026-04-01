"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getCustomMapStyle } from "./mapStyle";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface SpotMapProps {
  lng: number;
  lat: number;
  name: string;
}

export default function SpotMap({ lng, lat, name }: SpotMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const dark = document.documentElement.classList.contains("dark");

    map.current = new mapboxgl.Map({
      container: container.current,
      style: getCustomMapStyle(dark),
      center: [lng, lat],
      zoom: 15,
      interactive: true,
      attributionControl: false,
    });

    const el = document.createElement("div");
    el.style.cssText = `
      width: 14px;
      height: 14px;
      background: ${dark ? "#F7F7F3" : "#13120A"};
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    `;

    new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [lng, lat, name]);

  return <div ref={container} style={{ width: "100%", height: "100%" }} />;
}
