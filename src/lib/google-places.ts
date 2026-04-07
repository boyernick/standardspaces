/**
 * Google Places API (New) client.
 *
 * Used to enrich scraped spot data with photos, structured hours, precise
 * coordinates, phone/website, and amenity booleans that venues usually keep
 * up-to-date in Google Business Profiles even when their own sites lag.
 *
 * Field mask design: we only request the fields we actually merge into
 * `ScrapedData`. The mask determines the billing SKU tier (Essentials → free,
 * Pro → phone/hours/priceLevel, Enterprise → amenity booleans). Keep this
 * tight; Google charges per request × SKU, so widening the mask silently
 * widens the bill.
 *
 * Photo media: we use `skipHttpRedirect=true` so the endpoint returns JSON
 * with a resolved `photoUri` on Google's CDN (`lh3.googleusercontent.com`),
 * which we can store directly in our DB without exposing the API key.
 */

const API_BASE = "https://places.googleapis.com/v1";

// Field masks ---------------------------------------------------------------

// Cheap mask for the initial text search: just enough to identify candidates
// and pick the right one by website. We follow up with a single Details call
// for the winning candidate rather than paying Details pricing per candidate.
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.types",
  "places.primaryType",
  "places.location",
].join(",");

// Full mask for the chosen place. Ordered by billing tier so it's easy to
// audit at a glance.
const DETAILS_FIELD_MASK = [
  // Essentials (free)
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "photos",
  // Pro
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "priceLevel",
  "editorialSummary",
  "rating",
  "userRatingCount",
  // Enterprise (amenity signals — the reason we're paying for Google at all)
  "reservable",
  "servesCocktails",
  "servesBeer",
  "servesWine",
  "servesDinner",
  "servesLunch",
  "servesBrunch",
  "servesBreakfast",
  "outdoorSeating",
  "liveMusic",
  "goodForGroups",
  "goodForChildren",
  "allowsDogs",
  "parkingOptions",
  "paymentOptions",
].join(",");

// Public types --------------------------------------------------------------

export interface GooglePhoto {
  /** Google resource name, e.g. `places/.../photos/...`. Required to call the media endpoint. */
  name: string;
  widthPx: number;
  heightPx: number;
  /** Resolved `lh3.googleusercontent.com` URL. Populated by `resolvePhotoUrls`. */
  url?: string;
  attributions?: { displayName: string; uri?: string; photoUri?: string }[];
}

export interface GoogleAddressComponents {
  streetNumber?: string;
  route?: string;
  neighborhood?: string;
  locality?: string;
  adminArea2?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface GoogleAmenities {
  reservable?: boolean;
  servesCocktails?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesBrunch?: boolean;
  servesBreakfast?: boolean;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  goodForGroups?: boolean;
  goodForChildren?: boolean;
  allowsDogs?: boolean;
}

export interface GoogleParking {
  valetParking?: boolean;
  freeParkingLot?: boolean;
  paidParkingLot?: boolean;
  freeStreetParking?: boolean;
  paidStreetParking?: boolean;
  freeGarageParking?: boolean;
  paidGarageParking?: boolean;
}

export interface GooglePlace {
  placeId: string;
  name?: string;
  address?: string;
  addressComponents?: GoogleAddressComponents;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  /** Raw Google types, e.g. `["bar","cocktail_bar","restaurant","food"]`. */
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: string;
  /** Human-readable weekday schedule, one entry per day. */
  hoursText?: string[];
  /** "PRICE_LEVEL_INEXPENSIVE" | "_MODERATE" | "_EXPENSIVE" | "_VERY_EXPENSIVE" */
  priceLevel?: string;
  editorialSummary?: string;
  rating?: number;
  userRatingCount?: number;
  amenities: GoogleAmenities;
  parking: GoogleParking;
  photos: GooglePhoto[];
}

// Low-level HTTP ------------------------------------------------------------

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not set");
  return key;
}

async function googleFetch(
  url: string,
  fieldMask: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": fieldMask,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Places ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Parsing helpers -----------------------------------------------------------

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { types?: string[]; longText?: string; shortText?: string }[];
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  priceLevel?: string;
  editorialSummary?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  reservable?: boolean;
  servesCocktails?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesBrunch?: boolean;
  servesBreakfast?: boolean;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  goodForGroups?: boolean;
  goodForChildren?: boolean;
  allowsDogs?: boolean;
  parkingOptions?: Record<string, boolean>;
  photos?: {
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
  }[];
}

function parseAddressComponents(
  components: RawPlace["addressComponents"],
): GoogleAddressComponents | undefined {
  if (!components) return undefined;
  const out: GoogleAddressComponents = {};
  for (const c of components) {
    const types = c.types || [];
    const val = c.shortText || c.longText;
    if (!val) continue;
    if (types.includes("street_number")) out.streetNumber = val;
    else if (types.includes("route")) out.route = val;
    else if (types.includes("neighborhood")) out.neighborhood = val;
    else if (types.includes("locality")) out.locality = val;
    else if (types.includes("administrative_area_level_2")) out.adminArea2 = val;
    else if (types.includes("administrative_area_level_1")) out.region = val;
    else if (types.includes("postal_code")) out.postalCode = val;
    else if (types.includes("country")) out.country = val;
  }
  return out;
}

function rawToPlace(raw: RawPlace): GooglePlace {
  return {
    placeId: raw.id,
    name: raw.displayName?.text,
    address: raw.formattedAddress,
    addressComponents: parseAddressComponents(raw.addressComponents),
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    phone: raw.nationalPhoneNumber || raw.internationalPhoneNumber,
    website: raw.websiteUri,
    types: raw.types,
    primaryType: raw.primaryType,
    primaryTypeDisplayName: raw.primaryTypeDisplayName?.text,
    hoursText: raw.regularOpeningHours?.weekdayDescriptions,
    priceLevel: raw.priceLevel,
    editorialSummary: raw.editorialSummary?.text,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    amenities: {
      reservable: raw.reservable,
      servesCocktails: raw.servesCocktails,
      servesBeer: raw.servesBeer,
      servesWine: raw.servesWine,
      servesDinner: raw.servesDinner,
      servesLunch: raw.servesLunch,
      servesBrunch: raw.servesBrunch,
      servesBreakfast: raw.servesBreakfast,
      outdoorSeating: raw.outdoorSeating,
      liveMusic: raw.liveMusic,
      goodForGroups: raw.goodForGroups,
      goodForChildren: raw.goodForChildren,
      allowsDogs: raw.allowsDogs,
    },
    parking: {
      valetParking: raw.parkingOptions?.valetParking,
      freeParkingLot: raw.parkingOptions?.freeParkingLot,
      paidParkingLot: raw.parkingOptions?.paidParkingLot,
      freeStreetParking: raw.parkingOptions?.freeStreetParking,
      paidStreetParking: raw.parkingOptions?.paidStreetParking,
      freeGarageParking: raw.parkingOptions?.freeGarageParking,
      paidGarageParking: raw.parkingOptions?.paidGarageParking,
    },
    photos: (raw.photos || []).map((p) => ({
      name: p.name,
      widthPx: p.widthPx,
      heightPx: p.heightPx,
      attributions: (p.authorAttributions || []).map((a) => ({
        displayName: a.displayName || "",
        uri: a.uri,
        photoUri: a.photoUri,
      })),
    })),
  };
}

// Public API ----------------------------------------------------------------

export interface SearchCandidate {
  placeId: string;
  name?: string;
  address?: string;
  website?: string;
  types?: string[];
  primaryType?: string;
  lat?: number;
  lng?: number;
}

/**
 * Text search. Returns a list of candidates — no details, no photos.
 * Use `getPlaceDetails` on the chosen candidate.
 */
export async function searchPlaces(
  query: string,
  options?: {
    locationBias?: { lat: number; lng: number; radiusM: number };
  },
): Promise<SearchCandidate[]> {
  const body: Record<string, unknown> = { textQuery: query };
  if (options?.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.lat,
          longitude: options.locationBias.lng,
        },
        radius: options.locationBias.radiusM,
      },
    };
  }
  const json = (await googleFetch(
    `${API_BASE}/places:searchText`,
    SEARCH_FIELD_MASK,
    { method: "POST", body: JSON.stringify(body) },
  )) as { places?: RawPlace[] };
  return (json.places || []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text,
    address: p.formattedAddress,
    website: p.websiteUri,
    types: p.types,
    primaryType: p.primaryType,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  }));
}

/** Fetch full details for a known Place ID. */
export async function getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  try {
    const raw = (await googleFetch(
      `${API_BASE}/places/${encodeURIComponent(placeId)}`,
      DETAILS_FIELD_MASK,
    )) as RawPlace;
    return rawToPlace(raw);
  } catch (err) {
    console.warn("getPlaceDetails failed", err);
    return null;
  }
}

/**
 * Resolve a photo resource name to a public `lh3.googleusercontent.com` URL.
 * `skipHttpRedirect=true` makes Google return JSON instead of 302-ing to the
 * final URL, which lets us capture and store the CDN URL without exposing
 * the API key in any client-facing code path.
 */
export async function getPhotoUrl(
  photoName: string,
  maxHeightPx = 1600,
): Promise<string | null> {
  try {
    const url =
      `${API_BASE}/${photoName}/media` +
      `?maxHeightPx=${maxHeightPx}` +
      `&skipHttpRedirect=true` +
      `&key=${encodeURIComponent(apiKey())}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { photoUri?: string };
    return json.photoUri || null;
  } catch {
    return null;
  }
}

/** Resolve every photo on a GooglePlace in parallel, filling in `photo.url`. */
export async function resolvePhotoUrls(
  place: GooglePlace,
  maxHeightPx = 1600,
  limit = 10,
): Promise<GooglePlace> {
  const toResolve = place.photos.slice(0, limit);
  const resolved = await Promise.all(
    toResolve.map((p) => getPhotoUrl(p.name, maxHeightPx)),
  );
  return {
    ...place,
    photos: place.photos.map((p, i) =>
      i < resolved.length ? { ...p, url: resolved[i] || undefined } : p,
    ),
  };
}

// High-level helper: the shape the scraper actually wants ------------------

function hostnameOf(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Static city-center coordinates used to bias text searches when the HTML
 * scrape didn't produce coordinates. Keeps Mary Lou's from returning the
 * West Palm Beach location when no address has been scraped yet.
 *
 * Add entries as we expand beyond Miami.
 */
export const CITY_CENTERS: Record<string, { lat: number; lng: number; radiusM: number }> = {
  miami: { lat: 25.7617, lng: -80.1918, radiusM: 25000 },
  "miami beach": { lat: 25.7907, lng: -80.1300, radiusM: 10000 },
  "new york": { lat: 40.7580, lng: -73.9855, radiusM: 20000 },
  "los angeles": { lat: 34.0522, lng: -118.2437, radiusM: 30000 },
};

export function cityLocationBias(
  city?: string,
): { lat: number; lng: number; radiusM: number } | undefined {
  if (!city) return undefined;
  return CITY_CENTERS[city.toLowerCase().trim()];
}

/**
 * Find the right Google Place for a page we're scraping.
 *
 * Strategy:
 *  1. If `knownPlaceId` is provided (stored from a previous scrape), skip
 *     the text search entirely and go straight to Place Details. Cuts the
 *     per-rescrape API cost roughly in half and eliminates any risk of
 *     picking the wrong multi-location entity.
 *  2. Otherwise, text search by `name + city` with optional locationBias.
 *  3. Prefer the candidate whose website hostname matches the scraped
 *     page's hostname — the single most reliable disambiguator for
 *     multi-location brands (Mary Lou's Miami vs WPB vs Montauk).
 *  4. Fall back to the first candidate if nothing matches.
 *  5. Fetch full details + resolve photo URLs.
 */
export async function findPlaceForScrape(args: {
  name?: string;
  city?: string;
  website?: string;
  locationBias?: { lat: number; lng: number; radiusM: number };
  /** If known, skip text search and fetch details for this ID directly. */
  knownPlaceId?: string;
}): Promise<GooglePlace | null> {
  // Fast path: cached place ID
  if (args.knownPlaceId) {
    const details = await getPlaceDetails(args.knownPlaceId);
    if (details) return await resolvePhotoUrls(details);
    // Fall through to text search if the ID is stale / no longer valid
  }

  if (!args.name) return null;
  const query = [args.name, args.city].filter(Boolean).join(" ");

  // If no explicit locationBias was given but we know the city, bias to it.
  const bias = args.locationBias || cityLocationBias(args.city);

  let candidates: SearchCandidate[];
  try {
    candidates = await searchPlaces(query, { locationBias: bias });
  } catch (err) {
    console.warn("searchPlaces failed", err);
    return null;
  }
  if (candidates.length === 0) return null;

  const targetHost = hostnameOf(args.website);
  let chosen: SearchCandidate | undefined;
  if (targetHost) {
    chosen = candidates.find((c) => hostnameOf(c.website) === targetHost);
  }
  if (!chosen) chosen = candidates[0];

  const details = await getPlaceDetails(chosen.placeId);
  if (!details) return null;
  return await resolvePhotoUrls(details);
}
