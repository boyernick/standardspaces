const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address.trim()) return null;

  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const feature = data.features?.[0];

    if (!feature) return null;

    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}
