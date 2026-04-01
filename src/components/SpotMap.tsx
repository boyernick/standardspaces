"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    map.current = new mapboxgl.Map({
      container: container.current,
      style: dark
        ? "mapbox://styles/mapbox/dark-v12"
        : "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 15,
      interactive: true,
    });

    const el = document.createElement("div");
    el.style.cssText = `
      width: 14px;
      height: 14px;
      background: ${dark ? "#ffffff" : "#1a1a1a"};
      border-radius: 50%;
      border: 2px solid ${dark ? "#000000" : "#ffffff"};
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    `;

    new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [lng, lat, name]);

  return <div ref={container} style={{ width: "100%", height: "100%" }} />;
}
