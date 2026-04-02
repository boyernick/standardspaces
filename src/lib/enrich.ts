import * as cheerio from "cheerio";
import { ScrapedData, inferNeighborhood } from "./scraper";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// --- Google Places API enrichment ---

interface PlaceResult {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  priceLevel?: number;
  lat?: number;
  lng?: number;
  photos?: string[];
  rating?: number;
  totalRatings?: number;
  googleMapsUrl?: string;
  types?: string[];
}

async function searchGooglePlaces(query: string): Promise<PlaceResult | null> {
  if (!GOOGLE_API_KEY) return null;

  try {
    // Text Search to find the place
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    const place = searchData.results?.[0];
    if (!place) return null;

    // Get full Place Details
    const fields = "name,formatted_address,formatted_phone_number,website,opening_hours,price_level,geometry,photos,rating,user_ratings_total,url,types";
    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=${fields}&key=${GOOGLE_API_KEY}`
    );
    if (!detailRes.ok) return null;
    const detailData = await detailRes.json();
    const detail = detailData.result;
    if (!detail) return null;

    // Build photo URLs
    const photos: string[] = [];
    if (detail.photos) {
      for (const photo of detail.photos.slice(0, 10)) {
        photos.push(
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
        );
      }
    }

    // Format hours
    let hours: string | undefined;
    if (detail.opening_hours?.weekday_text) {
      hours = detail.opening_hours.weekday_text.join(" · ");
    }

    return {
      name: detail.name,
      address: detail.formatted_address,
      phone: detail.formatted_phone_number,
      website: detail.website,
      hours,
      priceLevel: detail.price_level,
      lat: detail.geometry?.location?.lat,
      lng: detail.geometry?.location?.lng,
      photos,
      rating: detail.rating,
      totalRatings: detail.user_ratings_total,
      googleMapsUrl: detail.url,
      types: detail.types,
    };
  } catch (err) {
    console.error("Google Places API error:", err);
    return null;
  }
}

function priceLevelToRange(level?: number): string | undefined {
  if (level === undefined || level === null) return undefined;
  return "$".repeat(Math.max(1, Math.min(4, level)));
}

// --- Yelp scrape fallback ---

interface YelpResult {
  name?: string;
  phone?: string;
  address?: string;
  hours?: string;
  priceRange?: string;
  photos?: string[];
  categories?: string[];
}

async function scrapeYelp(query: string): Promise<YelpResult | null> {
  try {
    // Search Yelp
    const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}&find_loc=Miami%2C+FL`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!searchRes.ok) return null;

    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);

    // Find the first business link
    const firstLink = $search('a[href*="/biz/"]').first().attr("href");
    if (!firstLink) return null;

    const bizUrl = firstLink.startsWith("http") ? firstLink : `https://www.yelp.com${firstLink}`;
    // Strip query params to get clean biz URL
    const cleanBizUrl = bizUrl.split("?")[0];

    // Scrape the business page
    const bizRes = await fetch(cleanBizUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!bizRes.ok) return null;

    const bizHtml = await bizRes.text();
    const $ = cheerio.load(bizHtml);

    const result: YelpResult = {};

    // Extract from JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "");
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item["@type"] === "Restaurant" || item["@type"] === "LocalBusiness" || item["@type"]?.includes?.("Restaurant")) {
            result.name = result.name || item.name;
            result.phone = result.phone || item.telephone;
            result.priceRange = result.priceRange || item.priceRange;
            if (item.address) {
              const addr = item.address;
              if (typeof addr === "string") result.address = addr;
              else result.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", ");
            }
            if (item.image) {
              const imgs = Array.isArray(item.image) ? item.image : [item.image];
              result.photos = imgs.filter((i: unknown) => typeof i === "string").slice(0, 5) as string[];
            }
          }
        }
      } catch { /* skip */ }
    });

    return result;
  } catch (err) {
    console.error("Yelp scrape error:", err);
    return null;
  }
}

// --- Instagram profile scrape ---

async function scrapeInstagramHandle(query: string): Promise<string | undefined> {
  try {
    // Simple approach: search Google for the Instagram handle
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " instagram")}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
    });
    if (!res.ok) return undefined;

    const html = await res.text();
    const match = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (match && match[1] !== "p" && match[1] !== "reel" && match[1] !== "explore") {
      return `@${match[1]}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// --- Main enrichment function ---

export async function enrichScrapedData(
  data: ScrapedData,
  city: string = "Miami"
): Promise<ScrapedData> {
  const placeName = data.name || "unknown";
  const searchQuery = `${placeName} ${city}`;

  console.log(`[enrich] Enriching "${placeName}" in ${city}...`);

  // Run Google Places and Yelp in parallel
  const [googleResult, yelpResult, instagramHandle] = await Promise.all([
    searchGooglePlaces(searchQuery),
    scrapeYelp(searchQuery),
    data.instagram ? Promise.resolve(undefined) : scrapeInstagramHandle(searchQuery),
  ]);

  if (googleResult) {
    console.log(`[enrich] Google Places: found "${googleResult.name}" with ${googleResult.photos?.length || 0} photos`);
  }
  if (yelpResult) {
    console.log(`[enrich] Yelp: found "${yelpResult.name}" with ${yelpResult.photos?.length || 0} photos`);
  }

  // Merge data — existing scraped data takes priority, Google fills gaps, then Yelp
  const enriched: ScrapedData = { ...data };

  // Address
  if (!enriched.address && googleResult?.address) {
    enriched.address = googleResult.address;
  }

  // Phone
  if (!enriched.phone) {
    enriched.phone = googleResult?.phone || yelpResult?.phone;
  }

  // Hours
  if (!enriched.hours && googleResult?.hours) {
    enriched.hours = googleResult.hours;
  }

  // Price range
  if (!enriched.priceRange) {
    enriched.priceRange = priceLevelToRange(googleResult?.priceLevel) || yelpResult?.priceRange;
  }

  // Coordinates
  if (!enriched.lat && googleResult?.lat) {
    enriched.lat = googleResult.lat;
  }
  if (!enriched.lng && googleResult?.lng) {
    enriched.lng = googleResult.lng;
  }

  // Website — prefer the original scraped one
  if (!enriched.website && googleResult?.website) {
    enriched.website = googleResult.website;
  }

  // Instagram
  if (!enriched.instagram && instagramHandle) {
    enriched.instagram = instagramHandle;
  }

  // Neighborhood — re-infer from enriched address if still missing
  if (!enriched.neighborhood && enriched.address) {
    enriched.neighborhood = inferNeighborhood(enriched.address, enriched.description);
  }

  // Photos — merge and deduplicate
  const allPhotos = [
    ...(enriched.imageUrls || []),
    ...(googleResult?.photos || []),
    ...(yelpResult?.photos || []),
  ];

  // Normalize URL for dedup: strip query params, protocol, trailing slash, resize params
  function normalizeForDedup(url: string): string {
    try {
      const u = new URL(url);
      // Strip common resize/quality params
      for (const key of ["w", "h", "width", "height", "q", "quality", "fit", "crop", "auto", "format", "fm", "dpr", "maxwidth", "maxheight", "size", "resize"]) {
        u.searchParams.delete(key);
      }
      // Normalize to lowercase path without trailing slash
      return (u.host + u.pathname).toLowerCase().replace(/\/+$/, "") + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
    } catch {
      return url.toLowerCase().split("?")[0].replace(/\/+$/, "");
    }
  }

  // Also detect same filename across different CDN paths
  function getFilename(url: string): string {
    try {
      const path = new URL(url).pathname;
      const parts = path.split("/");
      return parts[parts.length - 1].toLowerCase().split("?")[0];
    } catch {
      return "";
    }
  }

  const seenNormalized = new Set<string>();
  const seenFilenames = new Set<string>();
  const uniquePhotos: string[] = [];

  for (const url of allPhotos) {
    if (!url) continue;
    const normalized = normalizeForDedup(url);
    const filename = getFilename(url);

    // Skip if we've seen this normalized URL
    if (seenNormalized.has(normalized)) continue;

    // Skip if same filename and it's specific enough (not generic like "image.jpg")
    if (filename && filename.length > 10 && seenFilenames.has(filename)) continue;

    seenNormalized.add(normalized);
    if (filename && filename.length > 10) seenFilenames.add(filename);
    uniquePhotos.push(url);
  }

  enriched.imageUrls = uniquePhotos.slice(0, 10);

  return enriched;
}
