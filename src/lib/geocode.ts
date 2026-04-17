// Authoritative address → lat/lng resolver.
//
// Why two backends in priority order:
// 1. Google Geocoding returns the closest match for a given US address with
//    street-level precision and reliable ZIP/suite handling — best default.
// 2. Mapbox stays as a fallback so we don't hard-fail in environments without
//    Google access (CI, local dev without the key, Google outage).
//
// Returning the backend name ("google" | "mapbox") lets callers log
// provenance if they want to audit which rows came from where.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Backend that produced the hit — useful for logs and audits. */
  source: "google" | "mapbox";
  /** Google's canonicalized address when available; Mapbox's place_name otherwise. */
  formatted?: string;
}

async function geocodeGoogle(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_KEY}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
        formatted_address?: string;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const first = data.results[0];
    const loc = first.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      source: "google",
      formatted: first.formatted_address,
    };
  } catch {
    return null;
  }
}

async function geocodeMapbox(address: string): Promise<GeocodeResult | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; place_name?: string }>;
    };
    const feature = data.features?.[0];
    if (!feature?.center) return null;
    const [lng, lat] = feature.center;
    return { lat, lng, source: "mapbox", formatted: feature.place_name };
  } catch {
    return null;
  }
}

/**
 * Resolve an address to coordinates. Tries Google first (street-level
 * accuracy), falls back to Mapbox. Returns null only when both backends
 * fail or the address is blank.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;
  const google = await geocodeGoogle(address);
  if (google) return google;
  const mapbox = await geocodeMapbox(address);
  if (mapbox) return mapbox;
  return null;
}
