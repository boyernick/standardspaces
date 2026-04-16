// Narrow Google Places client — image-only. Perplexity handles every other
// field of the scrape now; this exists solely because the Places photo
// library is the most reliable way to pull venue photography, especially
// for JS-hydrated sites where our HTML image extractor returns nothing.
//
// Uses Places API (New):
//   • Text Search:  POST /v1/places:searchText → resolves name/address → placeId
//   • Photo media:  GET  /v1/{photoResource}/media?maxHeightPx=... → image bytes
//
// The photo media URLs we return embed the API key. They're never sent to
// the browser — they flow straight into `processPhotos`, which downloads
// the bytes server-side and rewrites them as Supabase Storage URLs.

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// How many photos to pull per place. Google returns up to 10 in
// `places.photos[]`; we take them all so downstream curation has the
// widest candidate pool. Callers can still narrow via the `limit` arg.
const MAX_PHOTOS = 10;

// Max edge size for the photo redirect. 1600px is the sweet spot between
// bandwidth and retina displays — larger sizes trigger more aggressive
// Google-side caching variance.
const PHOTO_MAX_PX = 1600;

export interface GooglePlacesPhotosResult {
  placeId: string;
  imageUrls: string[];
}

/**
 * Search Google Places by text query and return the top match's photo URLs.
 * Returns null on any failure (missing key, no match, transport error) —
 * scraping should never be blocked by a Places outage.
 *
 * The caller is responsible for building a high-quality query: typically
 * `"{name} {address}"` or `"{name} {city}"`. Accuracy falls off fast if
 * you pass just a hostname.
 */
export async function fetchGooglePlacesPhotos(
  query: string,
  options: { limit?: number } = {},
): Promise<GooglePlacesPhotosResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.warn("fetchGooglePlacesPhotos: GOOGLE_PLACES_API_KEY not set");
    return null;
  }
  if (!query || !query.trim()) return null;

  try {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // FieldMask is required in Places API (New). Request only what we
        // need — photos.name is the resource id for the media endpoint.
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos.name",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "fetchGooglePlacesPhotos search failed",
        res.status,
        text.slice(0, 200),
      );
      return null;
    }
    const json = (await res.json()) as {
      places?: Array<{
        id?: string;
        photos?: Array<{ name?: string }>;
      }>;
    };
    const place = json.places?.[0];
    if (!place?.id) return null;
    const cap = Math.min(options.limit ?? MAX_PHOTOS, MAX_PHOTOS);
    const photos = (place.photos ?? [])
      .map((p) => p.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, cap);
    const imageUrls = photos.map(
      (resourceName) =>
        `https://places.googleapis.com/v1/${resourceName}/media?maxHeightPx=${PHOTO_MAX_PX}&maxWidthPx=${PHOTO_MAX_PX}&key=${key}`,
    );
    return { placeId: place.id, imageUrls };
  } catch (err) {
    console.warn("fetchGooglePlacesPhotos error", err);
    return null;
  }
}
