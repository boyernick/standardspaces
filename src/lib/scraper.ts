import * as cheerio from "cheerio";
import { geocodeAddress } from "./geocode";
import {
  findPlaceForScrape,
  type GooglePlace,
  type GoogleAmenities,
  type GoogleParking,
} from "./google-places";
import { resolveUrlToPlace, fetchInstagramProfilePhotos, type ResolvedUrlHint } from "./url-resolvers";

export interface ScrapedData {
  name?: string;
  description?: string;
  address?: string;
  neighborhood?: string;
  phone?: string;
  website?: string;
  hours?: string;
  priceRange?: string;
  dressCode?: string;
  parking?: string;
  bookingUrl?: string;
  bookingPlatform?: string;
  menuUrl?: string;
  imageUrls: string[];
  instagram?: string;
  lat?: number;
  lng?: number;
  subcategory?: string[];
  vibes?: string[];
  category?: string;
  /** Google Places API (New) place ID. Stored on the recommendation row
   * inside scraped_data so re-scrapes can skip the text search step and
   * go straight to the Place Details endpoint. */
  googlePlaceId?: string;
}

// Bot-wall detection --------------------------------------------------------

/** Titles / body snippets that indicate a JS challenge page (Cloudflare,
 *  Akamai, PerimeterX, etc.) instead of real content. */
const BOT_WALL_SIGNALS = [
  "just a moment",        // Cloudflare
  "checking your browser", // Cloudflare variant
  "please wait",          // PerimeterX
  "access denied",        // Akamai / WAFs
  "attention required",   // Cloudflare interstitial
  "cf-browser-verification", // Cloudflare element ID
  "ray id",               // Cloudflare footer
];

function isBotWall($: cheerio.CheerioAPI): boolean {
  const title = $("title").text().trim().toLowerCase();
  const bodyText = $("body").text().slice(0, 2000).toLowerCase();
  // Very few real HTML elements means we likely got a challenge page
  const elementCount = $("body *").length;
  if (elementCount < 15 && BOT_WALL_SIGNALS.some((s) => title.includes(s) || bodyText.includes(s))) {
    return true;
  }
  // Cloudflare's challenge page always has this
  if (bodyText.includes("cf-browser-verification") || bodyText.includes("challenge-platform")) {
    return true;
  }
  return false;
}

/**
 * Best-effort venue name from a URL when the HTML scrape was blocked.
 *
 * Examples:
 *   "https://www.eatblueribbonmiami.com/" → "eatblueribbonmiami"
 *   "https://www.casatua.com/"            → "casatua"
 *   "https://the-surf-club.com/restaurant" → "the surf club"
 *
 * This is intentionally rough — it's only used as a Google Places text
 * search query alongside a city bias, so "eatblueribbonmiami" is plenty
 * for Google to find "Blue Ribbon Sushi Bar & Grill Miami".
 */
function nameFromUrl(url: string): string | undefined {
  try {
    let host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    // Strip TLD (.com, .co, .io, etc.)
    host = host.replace(/\.[a-z]{2,}$/, "");
    // Strip second-level country TLDs (.co.uk, .com.au)
    host = host.replace(/\.[a-z]{2,}$/, "");
    // Replace hyphens/dots with spaces
    host = host.replace(/[-_.]/g, " ").trim();
    return host || undefined;
  } catch {
    return undefined;
  }
}

// Follow redirects and get final URL + HTML
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  const html = await res.text();
  return { html, finalUrl: res.url };
}

// Extract Open Graph and meta tags
function extractMeta($: cheerio.CheerioAPI): Partial<ScrapedData> {
  const data: Partial<ScrapedData> = {};

  // OG tags
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");

  // Standard meta
  const metaDesc = $('meta[name="description"]').attr("content");
  const title = $("title").text();

  // Prefer og:site_name for multi-location sites (where og:title might be generic like "Miami")
  data.name = ogSiteName || ogTitle || title || undefined;
  data.description = ogDesc || metaDesc || undefined;

  // Clean name — remove " - Home", " | Restaurant", etc.
  if (data.name) {
    data.name = data.name.replace(/\s*[-|–—]\s*(Home|Official|Website|Restaurant|Bar|Cafe|Coffee|Hotel|Gym|Salon|Shop).*$/i, "").trim();
  }

  // Images — collect with minimal filtering, scoring happens later
  const imageUrls: string[] = [];

  // OG images (high priority — added first)
  $('meta[property="og:image"]').each((_, el) => {
    const url = $(el).attr("content");
    if (url && !imageUrls.includes(url)) imageUrls.push(url);
  });

  // Twitter card images
  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  if (twitterImage && !imageUrls.includes(twitterImage)) imageUrls.push(twitterImage);

  // All page images — collect everything, score later
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (!src) return;
    if (!imageUrls.includes(src)) imageUrls.push(src);
  });

  // srcset images (lazy-loaded / responsive)
  $("img[srcset], source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    // Pick the largest from srcset
    const candidates = srcset.split(",").map((s) => s.trim().split(/\s+/));
    let bestUrl = "";
    let bestWidth = 0;
    for (const [url, descriptor] of candidates) {
      const w = parseInt(descriptor) || 0;
      if (w > bestWidth && url) { bestWidth = w; bestUrl = url; }
    }
    if (bestUrl && !imageUrls.includes(bestUrl)) imageUrls.push(bestUrl);
  });

  data.imageUrls = imageUrls;

  return data;
}

// Flatten JSON-LD payloads. Many sites (anything using Yoast SEO, Rank Math,
// Schema Pro, etc.) emit a single root object with `@context` + `@graph: [...]`
// instead of an array of items. Some entities also reference each other via
// `@id`, with the actual data living deeper in the graph. We walk the whole
// thing recursively so we don't miss the Restaurant / PostalAddress / etc.
// regardless of how the page chose to nest them.
function flattenJsonLd(
  node: unknown,
  out: Record<string, unknown>[] = [],
  seen: WeakSet<object> = new WeakSet(),
): Record<string, unknown>[] {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const child of node) flattenJsonLd(child, out, seen);
    return out;
  }
  if (typeof node === "object") {
    if (seen.has(node as object)) return out;
    seen.add(node as object);
    const obj = node as Record<string, unknown>;
    out.push(obj);
    if (Array.isArray(obj["@graph"])) flattenJsonLd(obj["@graph"], out, seen);
    // Many multi-location businesses (Mary Lou's, restaurant groups, hotel
    // brands) wrap their per-city entities inside `subOrganization`, `branchOf`,
    // `department`, `member`, or `hasPart`. Without this we only see the
    // top-level Organization and miss every real FoodEstablishment.
    const nestedKeys = [
      "subOrganization",
      "department",
      "branchOf",
      "member",
      "hasPart",
      "makesOffer",
      "location",
      "containsPlace",
    ];
    for (const key of nestedKeys) {
      const v = obj[key];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const child of v) {
          // Skip pure @id references (no additional data)
          if (child && typeof child === "object" && !Array.isArray(child)) {
            const rec = child as Record<string, unknown>;
            if (rec["@type"] || Object.keys(rec).length > 1) {
              flattenJsonLd(child, out, seen);
            }
          }
        }
      } else if (typeof v === "object") {
        const rec = v as Record<string, unknown>;
        if (rec["@type"] || Object.keys(rec).length > 1) {
          flattenJsonLd(v, out, seen);
        }
      }
    }
  }
  return out;
}

// Tokenize a URL's pathname into distinctive slug words — used to pick the
// right per-city entity out of a multi-location JSON-LD graph.
function urlTokens(u: string): string[] {
  try {
    const parsed = new URL(u);
    const stop = new Set([
      "www", "com", "org", "net", "location", "locations",
      "home", "index", "page", "pages", "the", "our",
    ]);
    return parsed.pathname
      .toLowerCase()
      .split(/[/\-_]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stop.has(t));
  } catch {
    return [];
  }
}

function entityUrlMatchScore(item: Record<string, unknown>, pageTokens: string[]): number {
  if (pageTokens.length === 0) return 0;
  const urls: string[] = [];
  if (typeof item.url === "string") urls.push(item.url);
  const id = item["@id"];
  if (typeof id === "string") urls.push(id);
  if (urls.length === 0) return 0;
  const joined = urls.join(" ").toLowerCase();
  let score = 0;
  for (const t of pageTokens) if (joined.includes(t)) score += 1;
  return score;
}

// Does this entity's @type match one of the business types we care about?
// Handles both string ("Restaurant") and array (["Organization","Place","Restaurant"]) forms.
const BUSINESS_TYPES = new Set([
  "restaurant",
  "barorpub",
  "cafeorcoffeeshop",
  "hotel",
  "lodgingbusiness",
  "healthclub",
  "exercisegym",
  "sportsactivitylocation",
  "dayspa",
  "beautysalon",
  "spa",
  "store",
  "shoppingcenter",
  "localbusiness",
  "foodestablishment",
  "place",
  "organization",
]);

function entityTypes(item: Record<string, unknown>): string[] {
  const t = item["@type"];
  if (!t) return [];
  if (Array.isArray(t)) return t.map((x) => String(x).toLowerCase());
  return [String(t).toLowerCase()];
}

function isBusinessEntity(item: Record<string, unknown>): boolean {
  return entityTypes(item).some((t) => BUSINESS_TYPES.has(t));
}

// Extract structured data (JSON-LD)
function extractJsonLd($: cheerio.CheerioAPI, currentUrl?: string): Partial<ScrapedData> {
  const data: Partial<ScrapedData> = {};

  // First pass: collect every JSON-LD entity across every script tag, flattening @graph.
  const allEntities: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      flattenJsonLd(json, allEntities);
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  // When a single graph contains multiple business entities (restaurant group
  // with subOrganization per city), prefer the one whose url/@id best matches
  // the page we're scraping. Otherwise we'll silently pull from West Palm Beach
  // when the user requested the Miami location.
  const pageTokens = currentUrl ? urlTokens(currentUrl) : [];
  const businessEntities = allEntities.filter(isBusinessEntity);
  if (pageTokens.length > 0 && businessEntities.length > 1) {
    businessEntities.sort(
      (a, b) => entityUrlMatchScore(b, pageTokens) - entityUrlMatchScore(a, pageTokens),
    );
  }

  // Build an @id → entity index so we can resolve references like
  // address: { "@id": "https://komodomiami.com/#local-main-place-address" }
  const byId = new Map<string, Record<string, unknown>>();
  for (const e of allEntities) {
    const id = e["@id"];
    if (typeof id === "string") byId.set(id, e);
  }
  function resolveRef(value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const ref = (value as Record<string, unknown>)["@id"];
      if (typeof ref === "string" && byId.has(ref)) {
        // Only follow the ref if the referenced object has more keys than just @id
        const target = byId.get(ref)!;
        if (Object.keys(target).length > 1) return target;
      }
    }
    return value;
  }

  for (const item of businessEntities) {
    {
      // Skip generic names like just a city name
      const itemName = item.name;
      const genericNames = ["miami", "new york", "los angeles", "chicago", "houston", "dallas", "austin", "denver", "seattle", "boston", "atlanta", "las vegas"];
      if (typeof itemName === "string" && !genericNames.includes(itemName.toLowerCase().trim())) {
        data.name = data.name || itemName;
      }
      // Skip descriptions that are just contact info or mention the wrong city
      const itemDesc = item.description;
      if (typeof itemDesc === "string" && !itemDesc.startsWith("Contact") && itemDesc.length > 30) {
        data.description = data.description || itemDesc;
      }
      if (typeof item.telephone === "string") data.phone = data.phone || item.telephone;
      if (typeof item.priceRange === "string") data.priceRange = data.priceRange || item.priceRange;

      // Address — may be inline or referenced via @id
      const addrRaw = resolveRef(item.address);
      if (addrRaw) {
        if (typeof addrRaw === "string") {
          data.address = data.address || addrRaw;
        } else if (typeof addrRaw === "object") {
          const addr = addrRaw as Record<string, unknown>;
          const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter((p): p is string => typeof p === "string" && p.length > 0);
          if (parts.length > 0) data.address = data.address || parts.join(", ");
        }
      }

      // Coordinates
      const geo = resolveRef(item.geo) as Record<string, unknown> | undefined;
      if (geo && typeof geo === "object") {
        const lat = parseFloat(String(geo.latitude));
        const lng = parseFloat(String(geo.longitude));
        if (!Number.isNaN(lat) && !data.lat) data.lat = lat;
        if (!Number.isNaN(lng) && !data.lng) data.lng = lng;
      }

      // Hours
      if (item.openingHoursSpecification) {
        const hoursStr = formatHoursSpec(item.openingHoursSpecification);
        if (hoursStr) data.hours = data.hours || hoursStr;
      } else if (item.openingHours) {
        const oh = Array.isArray(item.openingHours) ? item.openingHours.join(" · ") : item.openingHours;
        if (typeof oh === "string") data.hours = data.hours || oh;
      }

      // Phone via contactPoint (Komodo, many Yoast sites use this)
      const contact = resolveRef(item.contactPoint) as Record<string, unknown> | undefined;
      if (contact && typeof contact === "object" && typeof contact.telephone === "string") {
        data.phone = data.phone || contact.telephone;
      }

      // Parking
      if (item.amenityFeature) {
        const amenities = Array.isArray(item.amenityFeature) ? item.amenityFeature : [item.amenityFeature];
        for (const a of amenities) {
          const aRec = a as Record<string, unknown>;
          const aName = String(aRec?.name || aRec?.value || "").toLowerCase();
          if (aName.includes("parking") || aName.includes("valet")) {
            data.parking = data.parking || (typeof aRec.name === "string" ? aRec.name : typeof aRec.value === "string" ? aRec.value : undefined);
          }
        }
      }
      if (typeof item.parking === "string") data.parking = data.parking || item.parking;

      // Images — inline, referenced, or as ImageObject
      if (item.image) {
        const images = Array.isArray(item.image) ? item.image : [item.image];
        for (const imgRaw of images) {
          const img = resolveRef(imgRaw);
          let url: string | undefined;
          if (typeof img === "string") url = img;
          else if (img && typeof img === "object") {
            const imgObj = img as Record<string, unknown>;
            url = typeof imgObj.url === "string" ? imgObj.url : typeof imgObj.contentUrl === "string" ? imgObj.contentUrl : undefined;
          }
          if (url && url.length > 0) {
            data.imageUrls = data.imageUrls || [];
            if (!data.imageUrls.includes(url)) data.imageUrls.push(url);
          }
        }
      }

      // Social profiles via sameAs
      if (item.sameAs) {
        const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
        for (const link of links) {
          if (typeof link === "string" && link.includes("instagram.com")) {
            const match = link.match(/instagram\.com\/([^/?]+)/);
            if (match && !data.instagram) data.instagram = `@${match[1]}`;
          }
        }
      }
    }
  }

  return data;
}

// Extract Instagram handle from page links
function extractInstagram($: cheerio.CheerioAPI): string | undefined {
  let handle: string | undefined;
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/instagram\.com\/([^/?]+)/);
      if (match && match[1] !== "p" && match[1] !== "reel") {
        handle = `@${match[1]}`;
        return false;
      }
    }
  });
  return handle;
}

// Miami neighborhood inference from address
const MIAMI_NEIGHBORHOODS: { name: string; patterns: RegExp[] }[] = [
  { name: "Brickell", patterns: [/\bbrickell\b/i, /\bse\s+1(st|2nd|3rd)\s+st\b/i] },
  { name: "Wynwood", patterns: [/\bwynwood\b/i, /\bnw\s+2(nd|3rd|4th|5th)\s+ave\b.*\bnw\s+2[0-9]+(st|nd|rd|th)\s+st\b/i] },
  { name: "Design District", patterns: [/\bdesign\s*district\b/i, /\bne\s+3(8|9|40|41)(st|nd|rd|th)\s+st\b/i] },
  { name: "South Beach", patterns: [/\bsouth\s*beach\b/i, /\bocean\s*dr/i, /\bcollins\s*ave\b/i, /\bwashington\s*ave\b.*\bmiami\s*beach\b/i] },
  { name: "Miami Beach", patterns: [/\bmiami\s*beach\b/i] },
  { name: "Coral Gables", patterns: [/\bcoral\s*gables\b/i, /\bponce\s*de\s*leon\b/i, /\bmiracle\s*mile\b/i] },
  { name: "Coconut Grove", patterns: [/\bcoconut\s*grove\b/i, /\bcoco\s*walk\b/i] },
  { name: "Downtown", patterns: [/\bdowntown\s*miami\b/i, /\bflaglers?\s+st\b/i, /\bbiscayne\s*blvd\b.*\b33132\b/i] },
  { name: "Midtown", patterns: [/\bmidtown\b/i, /\bnorth\s*midtown\b/i] },
  { name: "Edgewater", patterns: [/\bedgewater\b/i, /\bnortheast\s+\d+.*\b33137\b/i] },
  { name: "Little Havana", patterns: [/\blittle\s*havana\b/i, /\bcalle\s*ocho\b/i, /\bsw\s+8th\s+st\b/i] },
  { name: "Aventura", patterns: [/\baventura\b/i] },
  { name: "Doral", patterns: [/\bdoral\b/i] },
  { name: "Key Biscayne", patterns: [/\bkey\s*biscayne\b/i] },
  { name: "Bal Harbour", patterns: [/\bbal\s*harbour\b/i] },
  { name: "Surfside", patterns: [/\bsurfside\b/i] },
  { name: "North Miami", patterns: [/\bnorth\s*miami\b/i] },
  { name: "Overtown", patterns: [/\bovertown\b/i] },
  { name: "Little River", patterns: [/\blittle\s*river\b/i] },
  { name: "Upper East Side", patterns: [/\bupper\s*east\s*side\b/i] },
];

// Zip code to neighborhood mapping for Miami
const MIAMI_ZIP_NEIGHBORHOODS: Record<string, string> = {
  "33129": "Brickell",
  "33130": "Brickell",
  "33131": "Brickell",
  "33127": "Wynwood",
  "33137": "Edgewater",
  "33132": "Downtown",
  "33128": "Downtown",
  "33133": "Coconut Grove",
  "33134": "Coral Gables",
  "33146": "Coral Gables",
  "33135": "Little Havana",
  "33136": "Overtown",
  "33138": "Upper East Side",
  "33139": "South Beach",
  "33140": "Miami Beach",
  "33141": "Miami Beach",
  "33154": "Bal Harbour",
  "33160": "North Miami",
  "33180": "Aventura",
  "33149": "Key Biscayne",
  "33166": "Doral",
  "33172": "Doral",
  "33143": "South Miami",
  "33156": "Pinecrest",
};

export function inferNeighborhood(address?: string, description?: string): string | undefined {
  if (!address) return undefined;

  const combined = (address + " " + (description || "")).toLowerCase();

  // Try pattern matching first
  for (const { name, patterns } of MIAMI_NEIGHBORHOODS) {
    for (const p of patterns) {
      if (p.test(combined)) return name;
    }
  }

  // Try zip code
  const zipMatch = address.match(/\b(33\d{3})\b/);
  if (zipMatch && MIAMI_ZIP_NEIGHBORHOODS[zipMatch[1]]) {
    return MIAMI_ZIP_NEIGHBORHOODS[zipMatch[1]];
  }

  return undefined;
}

// Infer price range from category/subcategory context
function inferPriceRange(category?: string, subcategories?: string[]): string | undefined {
  const subs = subcategories || [];
  if (category === "dining") {
    if (subs.includes("Fine dining") || subs.includes("Omakase") || subs.includes("Tasting menu")) return "$$$$";
    return "$$$";
  }
  if (category === "drinks") {
    if (subs.includes("Speakeasy") || subs.includes("Lounge")) return "$$$";
    if (subs.includes("Nightclub")) return "$$$$";
    return "$$";
  }
  if (category === "hotels") return "$$$$";
  if (category === "wellness") {
    if (subs.includes("Spa")) return "$$$$";
    return "$$$";
  }
  if (category === "members") return "$$$$";
  if (category === "coffee") return "$$";
  if (category === "shopping") {
    if (subs.includes("Jewelry") || subs.includes("Watches")) return "$$$$";
    return "$$$";
  }
  return undefined;
}

// Infer dress code from category context
// Dress code is hard to pin down from structured data (Google doesn't
// expose it), and defaulting to a guess ("Smart casual" everywhere) is
// exactly the "wrong, forces a manual edit" failure mode we're fixing.
// Only emit a value when the category strongly implies one; otherwise
// leave it blank for the admin to decide.
function inferDressCode(category?: string, subcategories?: string[]): string | undefined {
  const subs = subcategories || [];
  if (category === "dining") {
    if (subs.includes("Fine dining") || subs.includes("Omakase") || subs.includes("Tasting menu")) {
      return "Smart casual";
    }
  }
  if (category === "drinks" && subs.includes("Nightclub")) {
    return "Upscale";
  }
  return undefined;
}

// Parking is populated from Google's structured parkingOptions (see
// googleParkingString); when Google doesn't know, leave it blank rather
// than guessing from the address. A Brickell zip code does not imply
// valet, and wrong defaults are worse than empty fields the admin can fill.
function inferParking(_address?: string): string | undefined {
  return undefined;
}

// Format openingHoursSpecification into a readable string
function formatHoursSpec(spec: unknown): string | undefined {
  if (!Array.isArray(spec)) return undefined;

  const dayAbbr: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
    Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
    "https://schema.org/Monday": "Mon", "https://schema.org/Tuesday": "Tue",
    "https://schema.org/Wednesday": "Wed", "https://schema.org/Thursday": "Thu",
    "https://schema.org/Friday": "Fri", "https://schema.org/Saturday": "Sat",
    "https://schema.org/Sunday": "Sun",
  };

  // Group entries by time range to compress output
  const grouped = new Map<string, string[]>();
  for (const h of spec) {
    const days = Array.isArray(h.dayOfWeek) ? h.dayOfWeek : [h.dayOfWeek];
    const time = `${h.opens || ""}–${h.closes || ""}`;
    for (const d of days) {
      const abbr = dayAbbr[d] || String(d).replace(/^https:\/\/schema\.org\//, "").slice(0, 3);
      if (!grouped.has(time)) grouped.set(time, []);
      grouped.get(time)!.push(abbr);
    }
  }

  const parts: string[] = [];
  for (const [time, days] of grouped) {
    if (days.length === 7) {
      parts.push(`Daily ${time}`);
    } else {
      parts.push(`${days.join(", ")} ${time}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

// Extract booking links (OpenTable, Resy, Tock, SevenRooms, Yelp Reservations)
function extractBookingLinks($: cheerio.CheerioAPI): { bookingUrl?: string; bookingPlatform?: string } {
  const platforms: { pattern: RegExp; name: string }[] = [
    { pattern: /opentable\.com/i, name: "OpenTable" },
    { pattern: /resy\.com/i, name: "Resy" },
    { pattern: /exploretock\.com/i, name: "Tock" },
    { pattern: /sevenrooms\.com/i, name: "SevenRooms" },
    { pattern: /yelp\.com\/reservations/i, name: "Yelp" },
  ];

  // Check all links on the page — collect all matches, prefer reservation links
  let bookingUrl: string | undefined;
  let bookingPlatform: string | undefined;
  const candidates: { url: string; platform: string; isReservation: boolean }[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const text = $(el).text().toLowerCase();
    for (const { pattern, name } of platforms) {
      if (pattern.test(href)) {
        const isReservation = /reserv|book/i.test(href) || /reserv|book/i.test(text);
        candidates.push({ url: href, platform: name, isReservation });
        break;
      }
    }
  });

  // Prefer reservation links over event/other links
  const best = candidates.find((c) => c.isReservation) || candidates[0];
  if (best) {
    bookingUrl = best.url;
    bookingPlatform = best.platform;
  }

  // Also check for reservation widgets / iframes
  if (!bookingUrl) {
    $("iframe[src], script[src]").each((_, el) => {
      if (bookingUrl) return false;
      const src = $(el).attr("src");
      if (!src) return;
      for (const { pattern, name } of platforms) {
        if (pattern.test(src)) {
          bookingUrl = src;
          bookingPlatform = name;
          return false;
        }
      }
    });
  }

  return { bookingUrl, bookingPlatform };
}

// Extract menu link from page
function extractMenuUrl($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  // Check JSON-LD for menu
  let menuUrl: string | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item.hasMenu) {
          menuUrl = typeof item.hasMenu === "string" ? item.hasMenu : item.hasMenu?.url;
        }
        if (item.menu) {
          menuUrl = typeof item.menu === "string" ? item.menu : item.menu?.url;
        }
      }
    } catch { /* skip */ }
  });
  if (menuUrl) return resolveUrl(menuUrl, baseUrl);

  // Check links with menu-related text or href — prefer links with "menu" in text
  const candidates: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase().trim();
    // Skip anchor-only links, javascript, and booking/event links
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (/sevenrooms|opentable|resy|tock|event/i.test(href)) return;
    if (/\bmenu\b/i.test(text) || /\bfood\s*&?\s*drink/i.test(text)) {
      candidates.push(href);
    } else if (/\/menu/i.test(href)) {
      candidates.push(href);
    }
  });

  if (candidates.length > 0) {
    return resolveUrl(candidates[0], baseUrl);
  }
  return undefined;
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// Extract dress code, parking, and hours from page text content
function extractPageDetails($: cheerio.CheerioAPI): { dressCode?: string; parking?: string; hours?: string; priceRange?: string } {
  const result: { dressCode?: string; parking?: string; hours?: string; priceRange?: string } = {};
  const bodyText = $("body").text();

  // Dress code — look for common patterns
  const dressCodePatterns = [
    /dress\s*code\s*[:–—-]\s*([^\n.]{3,60})/i,
    /attire\s*[:–—-]\s*([^\n.]{3,60})/i,
  ];
  for (const p of dressCodePatterns) {
    const m = bodyText.match(p);
    if (m) {
      result.dressCode = m[1].trim();
      break;
    }
  }

  // Class-based extraction (e.g. <p class="dress-content">…</p>).
  // Important: must NOT match "address" — filter the class name explicitly.
  if (!result.dressCode) {
    $('[class*="dress" i]').each((_, el) => {
      if (result.dressCode) return;
      const cls = ($(el).attr("class") || "").toLowerCase();
      // Require a real "dress" token, not "address"
      if (!/(^|[^a-z])dress/.test(cls)) return;
      const t = $(el).text().trim().replace(/\s+/g, " ");
      if (!t || t.length < 5 || t.length > 400) return;
      // Strip leading "Dress Code" label if present
      const stripped = t.replace(/^dress\s*code\s*[:\-–—]?\s*/i, "").trim();
      if (stripped.length > 5) result.dressCode = stripped;
    });
  }

  // Heading-based extraction: <h2>Dress Code</h2><p>…</p>
  if (!result.dressCode) {
    $("h1,h2,h3,h4").each((_, el) => {
      if (result.dressCode) return;
      const t = $(el).text().trim().toLowerCase();
      if (t === "dress code" || t === "attire" || t === "our dress code") {
        const next = $(el).next().text().trim().replace(/\s+/g, " ");
        if (next && next.length > 5 && next.length < 400) {
          result.dressCode = next;
        }
      }
    });
  }

  // Known dress code keywords in any text
  if (!result.dressCode) {
    const lcBody = bodyText.toLowerCase();
    if (lcBody.includes("smart casual")) result.dressCode = "Smart casual";
    else if (lcBody.includes("business casual")) result.dressCode = "Business casual";
    else if (lcBody.includes("cocktail attire")) result.dressCode = "Cocktail attire";
    else if (lcBody.includes("black tie")) result.dressCode = "Black tie";
    else if (lcBody.includes("resort casual")) result.dressCode = "Resort casual";
    else if (lcBody.includes("casual elegant")) result.dressCode = "Casual elegant";
  }

  // Parking — look for common patterns
  const parkingPatterns = [
    /parking\s*[:–—-]\s*([^\n.]{3,80})/i,
    /valet\s*(?:parking)?\s*[:–—-]\s*([^\n.]{3,80})/i,
  ];
  for (const p of parkingPatterns) {
    const m = bodyText.match(p);
    if (m) {
      result.parking = m[1].trim();
      break;
    }
  }

  if (!result.parking) {
    const lcBody = bodyText.toLowerCase();
    if (lcBody.includes("valet parking") || lcBody.includes("valet available")) result.parking = "Valet available";
    else if (lcBody.includes("complimentary valet")) result.parking = "Complimentary valet";
    else if (lcBody.includes("self-parking") || lcBody.includes("self parking")) result.parking = "Self-parking available";
    else if (lcBody.includes("street parking")) result.parking = "Street parking";
    else if (lcBody.includes("parking garage")) result.parking = "Parking garage";
  }

  // Hours — extract from body text patterns like "Monday: Closed" or "Dinner: 6PM - Close"
  if (!result.hours) {
    const lcBody = bodyText.toLowerCase();
    const hourPatterns = [
      // "Monday - Saturday: 5PM - 11PM" or "Mon-Sat 5pm-11pm"
      /(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*[-–—:]\s*(?:closed|\d{1,2}(?::?\d{2})?\s*(?:am|pm)\s*[-–—]\s*(?:close|\d{1,2}(?::?\d{2})?\s*(?:am|pm)))/gi,
      // "Dinner: 6PM - Close"
      /(?:dinner|lunch|brunch|breakfast|golden\s*hour|happy\s*hour)\s*[:]\s*\d{1,2}(?::?\d{2})?\s*(?:am|pm)\s*[-–—]\s*(?:close|\d{1,2}(?::?\d{2})?\s*(?:am|pm))/gi,
    ];
    const hourMatches: string[] = [];
    for (const p of hourPatterns) {
      let m;
      while ((m = p.exec(bodyText)) !== null && hourMatches.length < 5) {
        hourMatches.push(m[0].trim());
      }
    }
    if (hourMatches.length > 0) {
      result.hours = hourMatches.join(" · ");
    }
  }

  // Price range — look for $ signs if not already found
  const priceMatch = bodyText.match(/price\s*(?:range)?\s*[:–—-]\s*(\${1,4})/i);
  if (priceMatch) result.priceRange = priceMatch[1];
  if (!result.priceRange) {
    // Count consecutive $ signs in description/meta areas
    const metaText = ($('meta[name="description"]').attr("content") || "") + " " + ($('meta[property="og:description"]').attr("content") || "");
    const dollarMatch = metaText.match(/(\${2,4})/);
    if (dollarMatch) result.priceRange = dollarMatch[1];
  }

  return result;
}

// Infer category and subcategories from scraped text and structured data
function inferSubcategories(
  data: Partial<ScrapedData>,
  $: cheerio.CheerioAPI,
  currentUrl?: string,
  /** Additional type tokens from external sources (Google Places types,
   * cuisine hints, etc). Already lowercased, underscores replaced with spaces. */
  extraLdTypes?: string[],
): { category?: string; subcategory: string[] } {
  const text = [
    data.name,
    data.description,
    $('meta[property="og:title"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
    $("title").text(),
  ].filter(Boolean).join(" ").toLowerCase();

  // Check JSON-LD @type for category hints — flatten @graph and handle array @type values.
  const ldTypes: string[] = [];
  const ldEntities: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      flattenJsonLd(json, ldEntities);
    } catch { /* skip */ }
  });
  // When the graph holds multiple business entities (multi-location groups),
  // consider only the cuisine/type of the entity matching the scraped URL.
  const pageTokens = currentUrl ? urlTokens(currentUrl) : [];
  const businessLdEntities = ldEntities.filter(isBusinessEntity);
  let scopedEntities = ldEntities;
  if (pageTokens.length > 0 && businessLdEntities.length > 1) {
    const scored = businessLdEntities
      .map((e) => ({ e, score: entityUrlMatchScore(e, pageTokens) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0].score > 0) {
      scopedEntities = [scored[0].e];
    }
  }
  for (const item of scopedEntities) {
    for (const t of entityTypes(item)) ldTypes.push(t);
    const cuisine = item.servesCuisine;
    if (Array.isArray(cuisine)) ldTypes.push(...cuisine.map((c) => String(c).toLowerCase()));
    else if (typeof cuisine === "string") ldTypes.push(cuisine.toLowerCase());
  }

  // Fold in external type signals (Google Places) — these participate in
  // both keyword matching (via `combined`) and the ldCategoryMap / cuisine
  // override loops below.
  if (extraLdTypes && extraLdTypes.length > 0) {
    ldTypes.push(...extraLdTypes);
  }

  const combined = text + " " + ldTypes.join(" ");

  // Word-boundary keyword test. Plain `.includes("spa")` matches "space",
  // "spaces", "spaghetti", etc., which is how Komodo Miami got mis-tagged
  // as wellness. We escape regex specials and require a word boundary on
  // both sides — but allow accented characters (café, açaí) and punctuation.
  function matchKeyword(haystack: string, kw: string): boolean {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // \b doesn't play nicely with non-ASCII; use a manual non-letter lookaround.
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, "iu");
    return re.test(haystack);
  }

  // Map keywords to categories and subcategories
  const matches: { category: string; subcategory: string; weight: number }[] = [];

  const keywordMap: Record<string, Record<string, string[]>> = {
    dining: {
      "Fine dining": ["fine dining", "michelin", "prix fixe", "haute cuisine"],
      "Omakase": ["omakase", "sushi counter", "kaiseki"],
      "Seafood": ["seafood", "oyster", "raw bar", "ceviche", "lobster", "crab"],
      "Tasting menu": ["tasting menu", "degustation", "prix fixe", "multi-course"],
      "Steakhouse": ["steakhouse", "steak house", "prime beef", "dry aged"],
      "Italian": ["italian", "trattoria", "osteria", "ristorante", "pasta", "risotto"],
      "French": ["french", "brasserie", "bistro", "provençal"],
      "Japanese": ["japanese", "izakaya", "ramen", "tempura", "robata", "yakitori"],
      "Mediterranean": ["mediterranean", "mezze", "levantine"],
      "Latin American": ["latin", "latino", "south american", "colombian", "brazilian", "argentinian"],
      "Mexican": ["mexican", "taqueria", "mezcal", "mole"],
      "Peruvian": ["peruvian", "nikkei", "ceviche", "pisco"],
      "Asian fusion": ["asian fusion", "pan-asian", "pan asian", "southeast asian", "asian-inspired"],
      "Thai": ["thai", "pad thai"],
      "Indian": ["indian", "curry", "tandoor", "biryani"],
      "Middle Eastern": ["middle eastern", "lebanese", "turkish", "persian", "hummus", "shawarma"],
      "Greek": ["greek", "taverna", "souvlaki"],
      "Farm-to-table": ["farm-to-table", "farm to table", "locally sourced", "seasonal menu"],
      "Raw bar": ["raw bar", "crudo", "tartare"],
      "Sushi": ["sushi", "sashimi", "maki", "nigiri"],
      "Tapas": ["tapas", "small plates", "pintxos"],
      "Contemporary American": ["contemporary american", "modern american", "new american"],
      "New American": ["new american"],
      "Southern": ["southern", "cajun", "creole", "lowcountry"],
      "Barbecue": ["barbecue", "bbq", "barbeque", "smokehouse", "smoked"],
      "Pizza": ["pizza", "pizzeria", "neapolitan", "wood-fired"],
      "Vegan": ["vegan", "plant-based", "vegetarian"],
      "Chef's table": ["chef's table", "chefs table", "private dining"],
    },
    drinks: {
      "Cocktail bar": ["cocktail", "mixology", "craft cocktail"],
      "Wine bar": ["wine bar", "wine list", "sommelier"],
      "Speakeasy": ["speakeasy", "hidden bar", "secret bar", "password"],
      "Nightclub": ["nightclub", "club", "dj", "dance floor", "nightlife"],
      "Lounge": ["lounge"],
      "Rooftop bar": ["rooftop bar", "rooftop", "sky bar"],
      "Dive bar": ["dive bar", "neighborhood bar", "local bar"],
      "Tiki bar": ["tiki", "tropical cocktail"],
      "Mezcal bar": ["mezcal", "agave"],
      "Sake bar": ["sake bar", "sake"],
      "Champagne bar": ["champagne bar", "champagne lounge", "bubbles"],
      "Beer garden": ["beer garden", "biergarten"],
      "Brewery": ["brewery", "brewpub", "craft beer", "taproom"],
      "Sports bar": ["sports bar", "sports lounge"],
      "Jazz bar": ["jazz bar", "jazz club", "live jazz"],
      "Piano bar": ["piano bar", "piano lounge"],
      "Cigar lounge": ["cigar lounge", "cigar bar"],
      "Pool bar": ["pool bar", "poolside"],
      "Day club": ["day club", "dayclub", "day party", "pool party"],
    },
    coffee: {
      "Specialty coffee": ["specialty coffee", "third wave", "pour over", "single origin", "v60"],
      "Roastery": ["roaster", "roastery", "coffee roast"],
      "Café": ["cafe", "café"],
      "Matcha": ["matcha", "ceremonial matcha"],
      "Tea house": ["tea house", "tea room", "loose leaf"],
      "Bakery café": ["bakery café", "bakery cafe", "coffee and pastry"],
      "Espresso bar": ["espresso bar", "espresso"],
      "Coffee lab": ["coffee lab", "coffee tasting"],
      "Bakery": ["bakery", "boulangerie", "pastry", "pastries", "viennoiserie", "croissant", "sourdough", "artisan bread"],
      "Patisserie": ["patisserie", "pâtisserie", "macaron", "french pastry"],
      "Juice bar": ["juice bar", "cold pressed", "smoothie bar", "fresh juice"],
      "Açaí bar": ["açaí", "acai", "acai bowl"],
    },
    wellness: {
      "Gym": ["gym", "fitness center"],
      "Recovery": ["recovery", "recovery studio"],
      "Spa": ["spa", "day spa"],
      "Yoga": ["yoga", "hot yoga", "vinyasa", "ashtanga"],
      "Pilates": ["pilates", "reformer"],
      "Barbershop": ["barbershop", "barber"],
      "Salon": ["salon", "hair salon", "beauty salon"],
      "CrossFit": ["crossfit", "cross fit"],
      "Boxing": ["boxing", "boxing gym"],
      "Martial arts": ["martial arts", "mma", "jiu jitsu", "muay thai", "karate"],
      "Personal training": ["personal training", "personal trainer", "pt studio"],
      "Cold plunge": ["cold plunge", "ice bath", "cold water"],
      "Sauna": ["sauna", "steam room", "bathhouse"],
      "Cryotherapy": ["cryotherapy", "cryo"],
      "IV therapy": ["iv therapy", "iv drip", "vitamin drip"],
      "Medspa": ["medspa", "med spa", "medical spa", "botox", "filler"],
      "Float therapy": ["float", "sensory deprivation", "float tank"],
      "Massage": ["massage", "deep tissue", "sports massage"],
      "Facial studio": ["facial", "skincare studio"],
      "Nail studio": ["nail studio", "nail salon", "manicure", "pedicure"],
      "Acupuncture": ["acupuncture"],
      "Chiropractic": ["chiropractic", "chiropractor"],
      "Physical therapy": ["physical therapy", "physiotherapy"],
      "Cycling studio": ["cycling", "spin", "soulcycle"],
      "Dance studio": ["dance studio", "dance class"],
      "Climbing gym": ["climbing", "bouldering", "rock climbing"],
      "Tennis club": ["tennis", "tennis club", "padel"],
      "Golf": ["golf", "golf club", "driving range", "top golf"],
    },
    shopping: {
      "Fashion": ["fashion", "clothing", "apparel"],
      "Jewelry": ["jewelry", "jewellery", "jeweler", "fine jewelry"],
      "Watches": ["watches", "timepiece", "horology", "watch dealer"],
      "Art gallery": ["art gallery", "gallery", "exhibition", "contemporary art"],
      "Vintage": ["vintage", "consignment", "thrift", "resale", "pre-owned"],
      "Menswear": ["menswear", "men's clothing", "men's fashion"],
      "Womenswear": ["womenswear", "women's clothing", "women's fashion"],
      "Streetwear": ["streetwear", "hypebeast", "sneakerhead"],
      "Designer": ["designer", "luxury brand", "haute couture"],
      "Boutique": ["boutique", "curated shop"],
      "Sneakers": ["sneakers", "sneaker shop", "kicks"],
      "Eyewear": ["eyewear", "optical", "sunglasses"],
      "Leather goods": ["leather goods", "leather", "handbag"],
      "Home décor": ["home décor", "home decor", "interior design", "homeware"],
      "Furniture": ["furniture", "furnishing"],
      "Bookshop": ["bookshop", "bookstore", "books"],
      "Record shop": ["record shop", "record store", "vinyl"],
      "Plant shop": ["plant shop", "nursery", "plant store"],
      "Fragrance": ["fragrance", "perfume", "cologne", "scent"],
      "Concept store": ["concept store", "lifestyle store"],
      "Tailoring": ["tailoring", "tailor", "bespoke", "made to measure"],
      "Bridal": ["bridal", "wedding dress", "bridal boutique"],
      "Swimwear": ["swimwear", "swim", "bikini"],
      "Athleisure": ["athleisure", "activewear", "sportswear"],
    },
    members: {
      "Social club": ["social club", "members club", "private club", "membership"],
      "Business club": ["business club"],
      "Event space": ["event space", "private events", "event venue"],
      "Coworking": ["coworking", "co-working", "workspace", "shared office"],
      "Private dining": ["private dining", "private dining room"],
      "Wine club": ["wine club", "wine membership"],
      "Cigar club": ["cigar club"],
      "Beach club": ["beach club"],
      "Country club": ["country club"],
      "Networking club": ["networking", "networking club"],
      "Arts club": ["arts club", "art club", "creative club"],
      "Supper club": ["supper club"],
    },
    hotels: {
      "Boutique hotel": ["boutique hotel"],
      "Resort": ["resort", "beach resort"],
      "Villa": ["villa", "vacation rental"],
      "Design hotel": ["design hotel"],
      "Historic hotel": ["historic hotel", "heritage hotel"],
      "Beach hotel": ["beach hotel", "beachfront hotel", "oceanfront"],
      "Luxury hotel": ["luxury hotel", "five star", "5 star", "5-star"],
      "Aparthotel": ["aparthotel", "serviced apartment", "extended stay"],
      "Hostel": ["hostel"],
      "Bed & breakfast": ["bed and breakfast", "b&b", "bed & breakfast"],
      "Eco lodge": ["eco lodge", "eco hotel", "sustainable hotel"],
      "Wellness retreat": ["wellness retreat", "retreat", "detox retreat"],
      "Casino hotel": ["casino hotel", "casino resort"],
    },
  };

  // Also infer category from JSON-LD types. Keys cover both Schema.org types
  // (lowercased, e.g. "foodestablishment") and Google Places types (also
  // lowercased with underscores collapsed to spaces, e.g. "cocktail bar").
  const ldCategoryMap: Record<string, string> = {
    // Schema.org / JSON-LD
    restaurant: "dining",
    foodestablishment: "dining",
    barorpub: "drinks",
    cafeorcoffeeshop: "coffee",
    bakery: "coffee",
    hotel: "hotels",
    lodgingbusiness: "hotels",
    healthclub: "wellness",
    exercisegym: "wellness",
    gym: "wellness",
    sportsactivitylocation: "wellness",
    dayspas: "wellness",
    beautysalon: "wellness",
    spa: "wellness",
    store: "shopping",
    // Google Places (New) type vocabulary
    "cocktail bar": "drinks",
    "wine bar": "drinks",
    "sports bar": "drinks",
    "pub": "drinks",
    "bar": "drinks",
    "night club": "drinks",
    "nightclub": "drinks",
    "cafe": "coffee",
    "coffee shop": "coffee",
    "tea house": "coffee",
    "fine dining restaurant": "dining",
    "steak house": "dining",
    "seafood restaurant": "dining",
    "sushi restaurant": "dining",
    "italian restaurant": "dining",
    "french restaurant": "dining",
    "japanese restaurant": "dining",
    "mexican restaurant": "dining",
    "american restaurant": "dining",
    "asian restaurant": "dining",
    "mediterranean restaurant": "dining",
    "wellness center": "wellness",
    "yoga studio": "wellness",
    "fitness center": "wellness",
    "hair salon": "wellness",
    "nail salon": "wellness",
    "massage spa": "wellness",
    "lodging": "hotels",
    "resort hotel": "hotels",
    "boutique hotel": "hotels",
    "clothing store": "shopping",
    "jewelry store": "shopping",
    "shoe store": "shopping",
    "book store": "shopping",
    "furniture store": "shopping",
  };

  let inferredCategory: string | undefined;
  // `servesCuisine` is the strongest signal for bars masquerading as
  // FoodEstablishment (Mary Lou's has cuisine "Cocktail Bar" but type
  // FoodEstablishment → would otherwise be tagged dining). Check cuisine
  // signals before falling back to the generic @type map.
  const drinksCuisineSignals = [
    "cocktail bar",
    "cocktail lounge",
    "wine bar",
    "beer bar",
    "sports bar",
    "nightclub",
    "night club",
    "speakeasy",
  ];
  if (ldTypes.some((t) => drinksCuisineSignals.some((sig) => t.includes(sig)))) {
    inferredCategory = "drinks";
  }
  if (!inferredCategory) {
    for (const ldType of ldTypes) {
      if (ldCategoryMap[ldType]) {
        inferredCategory = ldCategoryMap[ldType];
        break;
      }
    }
  }

  for (const [cat, subcats] of Object.entries(keywordMap)) {
    for (const [subcat, keywords] of Object.entries(subcats)) {
      for (const kw of keywords) {
        if (matchKeyword(combined, kw)) {
          matches.push({ category: cat, subcategory: subcat, weight: kw.length });
          break;
        }
      }
    }
  }

  // Default subcategory per category — used as fallback when no keywords match
  const defaultSubcategory: Record<string, string> = {
    dining: "Fine dining",
    drinks: "Cocktail bar",
    coffee: "Specialty coffee",
    wellness: "Gym",
    shopping: "Fashion",
    members: "Social club",
    hotels: "Boutique hotel",
  };

  // JSON-LD type is the strongest signal — prefer it over keyword matches
  const categoryCounts = new Map<string, number>();
  for (const m of matches) {
    categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
  }
  const keywordCategory = categoryCounts.size > 0 ? [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
  const bestCategory = inferredCategory || keywordCategory;

  if (!bestCategory) {
    return { category: undefined, subcategory: [] };
  }

  // Return subcategories that match the best category
  const subcategories = [...new Set(matches.filter((m) => m.category === bestCategory).map((m) => m.subcategory))];

  // Fallback: ensure at least one subcategory
  if (subcategories.length === 0 && defaultSubcategory[bestCategory]) {
    subcategories.push(defaultSubcategory[bestCategory]);
  }

  return { category: bestCategory, subcategory: subcategories };
}

// Structured Google signals consumed directly by the contextual rules.
// These avoid relying on lossy keyword matching against `googleSignalText`
// when the HTML page has no body text (URL-hint / bot-wall paths).
interface GoogleVibeSignals {
  priceLevel?: string;
  amenities?: GoogleAmenities;
  parking?: GoogleParking;
  userRatingCount?: number;
}

// Infer vibes from page content, category, and subcategories
function inferVibes(
  data: Partial<ScrapedData>,
  $: cheerio.CheerioAPI,
  category?: string,
  subcategories?: string[],
  /** Additional lowercased phrase blob from external sources (Google
   * amenities → "live music outdoor seating good for groups", etc). */
  extraSignals?: string,
  /** Structured Google signals — used for price/amenity-driven rules. */
  googleSignals?: GoogleVibeSignals,
): string[] {
  const text = [
    data.name,
    data.description,
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
    $("title").text(),
  ].filter(Boolean).join(" ").toLowerCase();

  const bodyText = $("body").text().toLowerCase();
  const combined = text + " " + bodyText.slice(0, 3000) + " " + (extraSignals || "");

  const vibeKeywords: Record<string, string[]> = {
    "Date night": ["date night", "romantic dinner", "intimate dining", "candlelit", "couples"],
    "Late night": ["late night", "late-night", "open late", "after midnight", "open until 2", "open until 3", "open until 4", "open until 5"],
    "Special occasion": ["special occasion", "celebration", "anniversary", "birthday", "milestone", "private event"],
    "Brunch": ["brunch", "bottomless brunch", "sunday brunch", "weekend brunch", "breakfast"],
    "Business dinner": ["business dinner", "business lunch", "corporate", "private dining room", "executive"],
    "Group friendly": ["group", "large party", "large parties", "private events", "group dining", "group reservations"],
    "Outdoor seating": ["outdoor", "patio", "terrace", "al fresco", "garden seating", "sidewalk"],
    "Rooftop": ["rooftop", "roof deck", "sky bar", "rooftop bar", "rooftop lounge"],
    "Waterfront": ["waterfront", "oceanfront", "bayfront", "water view", "ocean view", "bay view", "beachfront"],
    "Live music": ["live music", "live band", "live dj", "dj set", "jazz night", "live entertainment", "live performance"],
    "People watching": ["people watching", "sidewalk café", "street-side"],
    "Hidden gem": ["hidden gem", "secret", "speakeasy", "password", "unmarked", "off the beaten"],
    "Sceney": ["see and be seen", "celebrity", "vip", "bottle service", "velvet rope", "exclusive"],
    "Chill": ["chill", "laid-back", "laid back", "relaxed", "casual vibes", "low-key", "lowkey"],
    "Romantic": ["romantic", "intimate", "candlelight", "couples", "valentine", "love"],
    "Power lunch": ["power lunch", "business lunch", "deal-making"],
    "Pre-game": ["pre-game", "pregame", "happy hour", "after work", "afterwork"],
    "After party": ["after party", "afterparty", "late night", "after hours"],
    "Day drinking": ["day drinking", "day party", "pool party", "day club", "daytime"],
    "Sunday funday": ["sunday funday", "sunday brunch", "sunday session"],
    "Solo friendly": ["solo", "bar seating", "counter seating", "solo dining", "come alone"],
    "Tourist must-do": ["must visit", "must-visit", "iconic", "landmark", "institution", "famous"],
    "Local favorite": ["local favorite", "local favourite", "neighborhood spot", "regulars", "local gem", "neighborhood gem"],
    "Aperitivo": ["aperitivo", "aperitif", "spritz", "negroni hour"],
    "Natural wine": ["natural wine", "low intervention", "skin contact", "orange wine", "biodynamic"],
    "Wellness ritual": ["wellness ritual", "self-care", "mindfulness", "meditation", "holistic", "detox"],
  };

  const matched: string[] = [];

  // Word-boundary match (same Unicode-safe approach as inferSubcategories).
  const matchVibeKw = (haystack: string, kw: string): boolean => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, "iu").test(haystack);
  };

  for (const [vibe, keywords] of Object.entries(vibeKeywords)) {
    for (const kw of keywords) {
      if (matchVibeKw(combined, kw)) {
        matched.push(vibe);
        break;
      }
    }
  }

  // Context-based vibe inference from category/subcategory
  const subs = subcategories || [];
  if (category === "dining") {
    if (subs.includes("Fine dining") || subs.includes("Omakase") || subs.includes("Tasting menu")) {
      if (!matched.includes("Date night")) matched.push("Date night");
      if (!matched.includes("Special occasion")) matched.push("Special occasion");
    }
    if (subs.includes("Steakhouse")) {
      if (!matched.includes("Business dinner")) matched.push("Business dinner");
    }
  }
  if (category === "drinks") {
    if (subs.includes("Speakeasy")) {
      if (!matched.includes("Hidden gem")) matched.push("Hidden gem");
      if (!matched.includes("Date night")) matched.push("Date night");
    }
    if (subs.includes("Rooftop bar")) {
      if (!matched.includes("Rooftop")) matched.push("Rooftop");
    }
    if (subs.includes("Nightclub") || subs.includes("Day club")) {
      if (!matched.includes("Late night")) matched.push("Late night");
    }
    if (subs.includes("Cocktail bar") || subs.includes("Wine bar")) {
      if (!matched.includes("Date night")) matched.push("Date night");
    }
  }
  if (category === "coffee") {
    if (!matched.includes("Solo friendly")) matched.push("Solo friendly");
  }
  if (category === "wellness") {
    if (subs.includes("Spa") || subs.includes("Recovery") || subs.includes("Cold plunge") || subs.includes("Sauna")) {
      if (!matched.includes("Wellness ritual")) matched.push("Wellness ritual");
    }
  }

  // Structured Google signals — these fire even when the HTML body is empty
  // (URL-hint / bot-wall paths), which is the majority of submissions.
  const g = googleSignals;
  if (g) {
    const add = (v: string) => { if (!matched.includes(v)) matched.push(v); };
    const a = g.amenities || {};
    const expensive =
      g.priceLevel === "PRICE_LEVEL_EXPENSIVE" ||
      g.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE";

    // Amenity-driven — category-agnostic
    if (a.outdoorSeating) add("Outdoor seating");
    if (a.liveMusic) add("Live music");
    if (a.goodForGroups) add("Group friendly");

    // Dining: price level is the strongest date-night / special-occasion signal
    // when subcategory keyword matching misses (e.g. Zuma tagged only as
    // "Japanese"). Reservable + dinner service confirm the sit-down occasion.
    if (category === "dining") {
      if (expensive) {
        add("Date night");
        add("Special occasion");
      }
      if (a.reservable && (a.servesDinner || a.servesCocktails || a.servesWine)) {
        add("Date night");
      }
      if (a.servesBrunch) add("Brunch");
    }

    if (category === "drinks") {
      if (a.servesWine && !a.servesCocktails) add("Date night");
      if (a.servesCocktails) add("Date night");
    }

    // Tourist must-do — very high rating counts indicate an iconic/landmark
    // venue the concierge audience is likely to have heard of.
    if (g.userRatingCount && g.userRatingCount >= 3000) {
      add("Tourist must-do");
    }
  }

  return matched;
}

// --- Image scoring and ranking ---

// Hard-reject patterns — these are never venue photos
const IMAGE_REJECT_PATTERNS = [
  /logo/i, /icon/i, /favicon/i, /sprite/i, /spacer/i, /pixel/i, /tracking/i,
  /badge/i, /avatar/i, /profile[-_]?pic/i, /gravatar/i, /widget/i, /button/i,
  /team[-_]?photo/i, /headshot/i, /portrait/i, /staff[-_]?photo/i, /employee/i,
  /family/i, /selfie/i, /person/i, /people/i, /founder/i, /about[-_]?us/i,
  /\.svg(\?|$)/i, /\.gif(\?|$)/i, /1x1/i, /transparent/i, /blank\./i,
  /facebook\.com/i, /twitter\.com/i, /google-analytics/i, /doubleclick/i,
  /adsystem/i, /adserver/i, /cloudflare/i, /recaptcha/i,
  /payment/i, /credit[-_]?card/i, /visa\b/i, /mastercard/i, /amex/i,
  /arrow/i, /chevron/i, /caret/i, /close[-_]?btn/i, /hamburger/i,
  /share[-_]?icon/i, /social[-_]?icon/i, /map[-_]?pin/i, /marker/i,
];

// Positive signals — boost score for these
const IMAGE_BOOST_PATTERNS = [
  { pattern: /hero/i, boost: 15 },
  { pattern: /gallery/i, boost: 12 },
  { pattern: /banner/i, boost: 8 },
  { pattern: /photo/i, boost: 8 },
  { pattern: /image/i, boost: 5 },
  { pattern: /interior/i, boost: 12 },
  { pattern: /exterior/i, boost: 10 },
  { pattern: /food/i, boost: 10 },
  { pattern: /dish/i, boost: 10 },
  { pattern: /cocktail/i, boost: 10 },
  { pattern: /dining/i, boost: 10 },
  { pattern: /restaurant/i, boost: 8 },
  { pattern: /bar\b/i, boost: 8 },
  { pattern: /lounge/i, boost: 8 },
  { pattern: /pool/i, boost: 8 },
  { pattern: /rooftop/i, boost: 8 },
  { pattern: /spa\b/i, boost: 8 },
  { pattern: /gym/i, boost: 8 },
  { pattern: /room/i, boost: 6 },
  { pattern: /ambiance|ambience|atmosphere/i, boost: 10 },
  { pattern: /featured/i, boost: 8 },
  { pattern: /slide/i, boost: 6 },
  { pattern: /carousel/i, boost: 6 },
  { pattern: /cover/i, boost: 6 },
  { pattern: /main/i, boost: 5 },
];

function scoreAndRankImages(
  candidates: string[],
  jsonLdImages: string[],
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string[] {
  interface ScoredImage {
    url: string;
    score: number;
  }

  const scored: ScoredImage[] = [];
  const jsonLdSet = new Set(jsonLdImages.map((u) => resolveUrl(u, baseUrl)));

  for (const url of candidates) {
    // Hard reject
    if (IMAGE_REJECT_PATTERNS.some((p) => p.test(url))) continue;

    let score = 0;

    // Source priority
    if (jsonLdSet.has(url)) score += 25; // JSON-LD images are curated by the site

    // Check if this was an OG/meta image (appears early in candidates from meta extraction)
    const isOgImage = $(`meta[property="og:image"][content="${url}"], meta[property="og:image"][content="${url.replace('https:', '')}"]`).length > 0;
    if (isOgImage) score += 20;

    // URL pattern boosting
    for (const { pattern, boost } of IMAGE_BOOST_PATTERNS) {
      if (pattern.test(url)) { score += boost; break; } // Only apply strongest match
    }

    // Image dimensions from HTML attributes
    const imgEl = $(`img[src="${url}"], img[data-src="${url}"], img[data-lazy-src="${url}"]`);
    if (imgEl.length > 0) {
      const width = parseInt(imgEl.attr("width") || "0");
      const height = parseInt(imgEl.attr("height") || "0");

      // Size scoring
      if (width > 0 && height > 0) {
        const area = width * height;
        if (area >= 500000) score += 20;       // 1000x500+: very large
        else if (area >= 200000) score += 15;   // ~600x333+: large
        else if (area >= 80000) score += 8;     // ~400x200+: medium
        else if (area < 10000) score -= 20;     // tiny: penalize heavily
        else if (area < 40000) score -= 5;      // small: mild penalty

        // Aspect ratio — venue photos are typically landscape (4:3, 16:9)
        const ratio = width / height;
        if (ratio >= 1.2 && ratio <= 2.0) score += 8;  // landscape
        else if (ratio >= 0.6 && ratio < 1.2) score += 4;  // square-ish
        else if (ratio > 3 || ratio < 0.3) score -= 10; // extreme banner or tower
      }

      // Position on page — earlier images are usually more important
      const allImgs = $("img").toArray();
      const idx = allImgs.findIndex((el) => {
        const s = $(el).attr("src") || $(el).attr("data-src") || "";
        return s === url;
      });
      if (idx >= 0 && idx < 3) score += 10;    // top 3 images
      else if (idx >= 3 && idx < 8) score += 5; // top 8

      // Alt text relevance
      const alt = (imgEl.attr("alt") || "").toLowerCase();
      if (alt.length > 5 && alt.length < 100) score += 3; // Has meaningful alt text
      for (const { pattern, boost } of IMAGE_BOOST_PATTERNS) {
        if (pattern.test(alt)) { score += Math.floor(boost * 0.5); break; }
      }

      // Parent element context
      const parentClass = (imgEl.parent().attr("class") || "") + " " + (imgEl.closest("section, div").attr("class") || "");
      if (/hero|banner|gallery|carousel|slider|featured|spotlight/i.test(parentClass)) score += 10;
      if (/nav|footer|sidebar|widget|cookie|popup|modal/i.test(parentClass)) score -= 15;
    } else {
      // CSS background image or no matching img tag — give base score
      score += 5;
    }

    // URL quality signals
    if (/\d{3,4}x\d{3,4}/.test(url)) score += 5; // Has dimensions in URL (common for high-res)
    if (/thumb|thumbnail|small|tiny|micro/i.test(url)) score -= 10;
    if (/large|full|original|high|hd|retina|2x/i.test(url)) score += 5;

    // Prefer common image CDNs known for quality content
    if (/ctfassets\.net|cloudinary|imgix|unsplash|squarespace-cdn/i.test(url)) score += 5;

    scored.push({ url, score });
  }

  // Sort by score descending, take top 10
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((s) => s.url);
}

// Main scrape function
// Same-origin subpage crawler. Many restaurant sites bury dress code, parking,
// and hours on /contact, /about, /faq etc. We follow up to MAX_SUBPAGES of
// these and merge anything we find into the main scrape.
const SUBPAGE_KEYWORDS = /(contact|about|info|hours|visit|faq|experience|policies?|dress|reserv|plan-?your|know-?before)/i;
const MAX_SUBPAGES = 5;

async function crawlSubpages(
  baseUrl: string,
  $: cheerio.CheerioAPI
): Promise<{ dressCode?: string; parking?: string; hours?: string; priceRange?: string; imageUrls: string[] }> {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return { imageUrls: [] };
  }

  const candidates = new Map<string, URL>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (abs.origin !== base.origin) return;
    if (abs.pathname === base.pathname) return;
    if (abs.pathname === "/" || abs.pathname === "") return;
    if (!SUBPAGE_KEYWORDS.test(abs.pathname)) return;
    abs.hash = "";
    abs.search = "";
    candidates.set(abs.toString(), abs);
  });

  const urls = Array.from(candidates.keys()).slice(0, MAX_SUBPAGES);
  if (urls.length === 0) return { imageUrls: [] };

  const subResults = await Promise.all(
    urls.map(async (u) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(u, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("html")) return null;
        const html = await res.text();
        const sub$ = cheerio.load(html);
        const details = extractPageDetails(sub$);
        // Pull og:image from subpage too
        const ogImg = sub$('meta[property="og:image"]').attr("content");
        const subImages: string[] = [];
        if (ogImg) subImages.push(resolveUrl(ogImg, u));
        return { details, subImages };
      } catch {
        return null;
      }
    })
  );

  const merged: { dressCode?: string; parking?: string; hours?: string; priceRange?: string; imageUrls: string[] } = {
    imageUrls: [],
  };
  for (const r of subResults) {
    if (!r) continue;
    if (!merged.dressCode && r.details.dressCode) merged.dressCode = r.details.dressCode;
    if (!merged.parking && r.details.parking) merged.parking = r.details.parking;
    if (!merged.hours && r.details.hours) merged.hours = r.details.hours;
    if (!merged.priceRange && r.details.priceRange) merged.priceRange = r.details.priceRange;
    for (const img of r.subImages) {
      if (!merged.imageUrls.includes(img)) merged.imageUrls.push(img);
    }
  }
  return merged;
}

// --- Google Places → scraper signal adapters ---

/** Normalize Google Place types ("cocktail_bar") to inferrer tokens ("cocktail bar"). */
function googleTypeTokens(place: GooglePlace): string[] {
  const raw = [...(place.types || [])];
  if (place.primaryType) raw.push(place.primaryType);
  if (place.primaryTypeDisplayName) raw.push(place.primaryTypeDisplayName);
  return raw
    .map((t) => String(t).toLowerCase().replace(/_/g, " ").trim())
    .filter((t) => t.length > 0);
}

/** Flatten Google amenity/parking booleans into a space-joined phrase blob
 *  that `inferVibes` can keyword-match against. */
function googleSignalText(place: GooglePlace): string {
  const parts: string[] = [];
  const a = place.amenities;
  if (a.reservable) parts.push("reservations reservable");
  if (a.servesCocktails) parts.push("craft cocktail cocktail");
  if (a.servesWine) parts.push("wine bar wine list");
  if (a.servesBeer) parts.push("beer craft beer");
  if (a.servesBrunch) parts.push("brunch");
  if (a.servesDinner) parts.push("dinner");
  if (a.outdoorSeating) parts.push("outdoor seating patio terrace");
  if (a.liveMusic) parts.push("live music live entertainment");
  if (a.goodForGroups) parts.push("group friendly large parties");
  if (a.goodForChildren) parts.push("family friendly kids");
  const p = place.parking;
  if (p.valetParking) parts.push("valet parking");
  if (p.freeParkingLot || p.paidParkingLot) parts.push("parking lot");
  if (p.freeStreetParking || p.paidStreetParking) parts.push("street parking");
  if (p.freeGarageParking || p.paidGarageParking) parts.push("garage parking");
  return parts.join(" ");
}

/** Human-readable parking string synthesized from Google parking booleans. */
/**
 * Map Google's parkingOptions booleans to one of the canonical strings the
 * admin form's Parking dropdown recognizes (see PARKING_OPTIONS in
 * ReviewForm.tsx). Keeps re-scrapes from dropping into "(custom)" mode.
 */
function googleParkingString(place: GooglePlace): string | undefined {
  const p = place.parking;
  if (p.valetParking) return "Valet";
  if (p.freeParkingLot || p.paidParkingLot) return "Parking lot";
  if (p.freeGarageParking || p.paidGarageParking) return "Parking garage";
  if (p.freeStreetParking || p.paidStreetParking) return "Street parking";
  return undefined;
}

/** Price level enum → "$" string used throughout the app. */
function googlePriceLevelToDollars(level?: string): string | undefined {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: return undefined;
  }
}

/** Join Google weekday descriptions into a single multi-line hours string. */
function googleHoursString(place: GooglePlace): string | undefined {
  if (!place.hoursText || place.hoursText.length === 0) return undefined;
  return place.hoursText.join("\n");
}

export interface ScrapeOptions {
  /** City slug/name used to bias the Google Places text search when the
   * HTML scrape hasn't yet produced an address/coordinates. */
  city?: string;
  /** If a prior scrape persisted a Google place ID, pass it here to skip
   * the text-search step and go straight to Place Details. */
  knownPlaceId?: string;
}

export async function scrapeUrl(
  url: string,
  options?: ScrapeOptions,
): Promise<ScrapedData> {
  // --- Maps / Apple Maps / Instagram fast path ---------------------------
  // These URLs either redirect through a JS app or sit behind bot walls, so
  // the HTML we'd fetch contains nothing useful. If we can pull a place ID
  // or a coordinate-biased venue name out of the URL itself, skip straight
  // to Google Places — we'll get a populated record instead of an empty
  // shell for the admin to fill in by hand.
  let urlHint: ResolvedUrlHint | null = null;
  try {
    urlHint = await resolveUrlToPlace(url);
  } catch {
    urlHint = null;
  }
  if (urlHint?.matched) {
    return scrapeFromUrlHint(urlHint, options);
  }

  const { html, finalUrl } = await fetchPage(url);
  const $ = cheerio.load(html);

  // --- Bot-wall fast path ------------------------------------------------
  // If the page is a Cloudflare/Akamai challenge, the HTML is useless. Skip
  // all HTML extraction and go straight to Google Places using the domain
  // name as a search query. This produces surprisingly good results because
  // most venue domains contain their name (eatblueribbonmiami.com →
  // "Blue Ribbon Sushi Bar & Grill").
  if (isBotWall($)) {
    console.warn(`Bot wall detected for ${url} — falling back to Google Places`);
    return scrapeViaBotWallFallback(url, finalUrl, options);
  }

  const meta = extractMeta($);
  const jsonLd = extractJsonLd($, finalUrl);
  const instagram = extractInstagram($);
  const booking = extractBookingLinks($);
  const menuUrl = extractMenuUrl($, finalUrl);
  const pageDetails = extractPageDetails($);

  // Crawl a few same-origin subpages (contact, about, faq…) for fields
  // commonly buried off the homepage. Best-effort, fully optional.
  const needsMoreFromSubpages =
    !jsonLd.parking ||
    !pageDetails.dressCode ||
    !pageDetails.parking ||
    (!jsonLd.hours && !pageDetails.hours);
  const emptySubpageDetails: Awaited<ReturnType<typeof crawlSubpages>> = { imageUrls: [] };
  const subpageDetails = needsMoreFromSubpages
    ? await crawlSubpages(finalUrl, $).catch(() => emptySubpageDetails)
    : emptySubpageDetails;

  // Extract CSS background images
  const bgImages: string[] = [];
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const bgMatch = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (bgMatch && bgMatch[1]) {
      const resolved = resolveUrl(bgMatch[1], finalUrl);
      if (!bgImages.includes(resolved)) bgImages.push(resolved);
    }
  });

  // Collect all candidate images and score them
  const allCandidates = [...new Set([
    ...(jsonLd.imageUrls || []),
    ...(meta.imageUrls || []),
    ...bgImages,
    ...subpageDetails.imageUrls,
  ])]
    .filter((url) => url && url.length > 0)
    .map((url) => resolveUrl(url, finalUrl));

  const allImages = scoreAndRankImages(allCandidates, jsonLd.imageUrls || [], $, finalUrl);

  // Merge — JSON-LD takes priority, then page extraction, then meta
  const merged: Partial<ScrapedData> = {
    name: jsonLd.name || meta.name,
    description: jsonLd.description || meta.description,
    address: jsonLd.address,
    phone: jsonLd.phone,
    website: finalUrl,
    hours: jsonLd.hours || pageDetails.hours || subpageDetails.hours,
    priceRange: jsonLd.priceRange || pageDetails.priceRange || subpageDetails.priceRange,
    dressCode: pageDetails.dressCode || subpageDetails.dressCode,
    parking: jsonLd.parking || pageDetails.parking || subpageDetails.parking,
    bookingUrl: booking.bookingUrl,
    bookingPlatform: booking.bookingPlatform,
    menuUrl,
    imageUrls: allImages,
    instagram: jsonLd.instagram || instagram || meta.instagram,
    lat: jsonLd.lat,
    lng: jsonLd.lng,
  };

  // --- Google Places enrichment -----------------------------------------
  // HTML scraping is brittle for venue fundamentals (phone, hours, parking,
  // exact coordinates, professional photos). Google Business Profiles keep
  // these fresh for virtually every public venue, so we let Google be the
  // authority on those fields while HTML stays the authority on branding,
  // booking/menu URLs, Instagram handles, and category/vibe language.
  //
  // This call is fully optional and best-effort: we swallow errors and
  // fall back to the HTML-only scrape so this integration can never
  // regress the existing path. Requires `GOOGLE_PLACES_API_KEY` in env.
  let googlePlace: GooglePlace | null = null;
  if (
    process.env.GOOGLE_PLACES_API_KEY &&
    (options?.knownPlaceId || merged.name)
  ) {
    try {
      // City hint priority:
      //  1. Explicit `options.city` from the caller (admin form, etc.)
      //  2. Locality parsed out of the HTML-scraped address
      //  3. Nothing — rely on text-search fuzzy matching
      const addressCity = merged.address?.match(/,\s*([^,]+?),\s*[A-Z]{2}\b/)?.[1]?.trim();
      const cityHint = options?.city || addressCity;
      googlePlace = await findPlaceForScrape({
        name: merged.name,
        city: cityHint,
        website: finalUrl,
        knownPlaceId: options?.knownPlaceId,
        // Explicit bias from scraped coords wins; otherwise the helper will
        // fall back to the city-center lookup internally.
        locationBias: merged.lat && merged.lng
          ? { lat: merged.lat, lng: merged.lng, radiusM: 10000 }
          : undefined,
      });
    } catch (err) {
      console.warn("Google Places enrichment failed", err);
    }
  }

  if (googlePlace) {
    // Cache the place ID so re-scrapes skip the text search step.
    merged.googlePlaceId = googlePlace.placeId;

    // Fields where Google is the authority — always override if present.
    if (googlePlace.lat && googlePlace.lng) {
      merged.lat = googlePlace.lat;
      merged.lng = googlePlace.lng;
    }
    if (googlePlace.phone) merged.phone = googlePlace.phone;
    if (googlePlace.address) merged.address = googlePlace.address;
    const ghours = googleHoursString(googlePlace);
    if (ghours) merged.hours = ghours;

    // Price range — Google fills this in for ~everyone. HTML only wins
    // if Google hasn't bothered.
    const gprice = googlePriceLevelToDollars(googlePlace.priceLevel);
    if (gprice) merged.priceRange = gprice;

    // Description — editorialSummary is Google's short blurb; use it only
    // when HTML found nothing.
    if (!merged.description && googlePlace.editorialSummary) {
      merged.description = googlePlace.editorialSummary;
    }

    // Parking — prefer HTML's human-written "Valet available" over Google's
    // synthesized "Valet, Free lot" only when HTML found something specific.
    if (!merged.parking) {
      const gparking = googleParkingString(googlePlace);
      if (gparking) merged.parking = gparking;
    }

    // Photos — prepend Google's high-quality curated photos ahead of the
    // scored HTML candidates. Google photos go through `resolvePhotoUrls`
    // so they're already public `lh3.googleusercontent.com` URLs.
    const googlePhotoUrls = googlePlace.photos
      .map((p) => p.url)
      .filter((u): u is string => !!u);
    if (googlePhotoUrls.length > 0) {
      merged.imageUrls = [
        ...googlePhotoUrls,
        ...(merged.imageUrls || []).filter((u) => !googlePhotoUrls.includes(u)),
      ];
    }
  }

  // Backfill from Instagram when we have a handle but thin photo coverage
  // (< 6). Best-effort — IG markup breaks periodically, so failures fall
  // through silently.
  if (merged.instagram && (merged.imageUrls?.length || 0) < 6) {
    const igPhotos = await fetchInstagramProfilePhotos(merged.instagram, 6).catch(
      () => [] as string[],
    );
    if (igPhotos.length > 0) {
      const seen = new Set(merged.imageUrls || []);
      const appended = [...(merged.imageUrls || [])];
      for (const u of igPhotos) {
        if (!seen.has(u)) {
          appended.push(u);
          seen.add(u);
        }
      }
      merged.imageUrls = appended;
    }
  }

  // Geocode address when coordinates are still missing
  if (!merged.lat && !merged.lng && merged.address) {
    const geo = await geocodeAddress(merged.address);
    if (geo) {
      merged.lat = geo.lat;
      merged.lng = geo.lng;
    }
  }

  // Build signal inputs for category + vibe inference from Google data.
  const googleTypes = googlePlace ? googleTypeTokens(googlePlace) : undefined;
  const googleVibeSignals = googlePlace ? googleSignalText(googlePlace) : undefined;

  // Infer category and subcategories from page content + Google types
  const inferred = inferSubcategories(merged, $, finalUrl, googleTypes);

  // Neighborhood — prefer Google's address-component neighborhood, fall back
  // to pattern/zip inference from the address string.
  const googleHood = googlePlace?.addressComponents?.neighborhood;
  const neighborhood =
    googleHood && googleHood !== "City Center" // Google's generic default for South Beach
      ? googleHood
      : inferNeighborhood(merged.address, merged.description);

  // Infer price range, dress code, parking from context if not scraped
  const finalPriceRange = merged.priceRange || inferPriceRange(inferred.category, inferred.subcategory);
  const finalDressCode = merged.dressCode || inferDressCode(inferred.category, inferred.subcategory);
  const finalParking = merged.parking || inferParking(merged.address);

  // Infer vibes — page content + category context + Google amenity signals
  const vibes = inferVibes(
    merged,
    $,
    inferred.category,
    inferred.subcategory,
    googleVibeSignals,
    googlePlace
      ? {
          priceLevel: googlePlace.priceLevel,
          amenities: googlePlace.amenities,
          parking: googlePlace.parking,
          userRatingCount: googlePlace.userRatingCount,
        }
      : undefined,
  );

  const result: ScrapedData = {
    ...merged,
    imageUrls: merged.imageUrls || [],
    category: inferred.category,
    subcategory: inferred.subcategory.length > 0 ? inferred.subcategory : undefined,
    vibes: vibes.length > 0 ? vibes : undefined,
    neighborhood,
    priceRange: finalPriceRange,
    dressCode: finalDressCode,
    parking: finalParking,
  };

  return result;
}

// --- Bot-wall fallback ---------------------------------------------------
// When the HTML scrape is blocked by Cloudflare et al., we skip all HTML
// parsing and construct a ScrapedData entirely from Google Places data.
// The domain name is used as the text-search query.

async function scrapeViaBotWallFallback(
  originalUrl: string,
  finalUrl: string,
  options?: ScrapeOptions,
): Promise<ScrapedData> {
  const domainName = nameFromUrl(originalUrl);

  // If we don't even have a domain-derived name AND no knownPlaceId, give up
  // and return a mostly-empty result so the admin can manually fill it in.
  if (!domainName && !options?.knownPlaceId) {
    return {
      name: undefined,
      website: finalUrl,
      imageUrls: [],
    };
  }

  let googlePlace: GooglePlace | null = null;
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const cityHint = options?.city || "Miami";
      googlePlace = await findPlaceForScrape({
        name: domainName,
        city: cityHint,
        website: finalUrl,
        knownPlaceId: options?.knownPlaceId,
      });
    } catch (err) {
      console.warn("Google Places fallback failed", err);
    }
  }

  if (!googlePlace) {
    return {
      name: domainName,
      website: finalUrl,
      imageUrls: [],
    };
  }

  // Build merged data from Google Places (the sole data source)
  const merged: Partial<ScrapedData> = {
    name: googlePlace.name,
    website: finalUrl,
    googlePlaceId: googlePlace.placeId,
  };

  if (googlePlace.lat && googlePlace.lng) {
    merged.lat = googlePlace.lat;
    merged.lng = googlePlace.lng;
  }
  if (googlePlace.phone) merged.phone = googlePlace.phone;
  if (googlePlace.address) merged.address = googlePlace.address;
  if (googlePlace.editorialSummary) merged.description = googlePlace.editorialSummary;

  const ghours = googleHoursString(googlePlace);
  if (ghours) merged.hours = ghours;

  const gprice = googlePriceLevelToDollars(googlePlace.priceLevel);
  if (gprice) merged.priceRange = gprice;

  const gparking = googleParkingString(googlePlace);
  if (gparking) merged.parking = gparking;

  // Photos — all from Google
  const googlePhotoUrls = googlePlace.photos
    .map((p) => p.url)
    .filter((u): u is string => !!u);
  merged.imageUrls = googlePhotoUrls;

  // Geocode if Google didn't provide coordinates
  if (!merged.lat && !merged.lng && merged.address) {
    const geo = await geocodeAddress(merged.address);
    if (geo) {
      merged.lat = geo.lat;
      merged.lng = geo.lng;
    }
  }

  // Infer category, neighborhood, vibes from Google data
  const googleTypes = googleTypeTokens(googlePlace);
  const googleVibeSignals = googleSignalText(googlePlace);

  // Use a dummy cheerio instance since we have no real HTML
  const empty$ = cheerio.load("<html><body></body></html>");
  const inferred = inferSubcategories(merged, empty$, finalUrl, googleTypes);

  const googleHood = googlePlace.addressComponents?.neighborhood;
  const neighborhood =
    googleHood && googleHood !== "City Center"
      ? googleHood
      : inferNeighborhood(merged.address, merged.description);

  const finalPriceRange = merged.priceRange || inferPriceRange(inferred.category, inferred.subcategory);
  const finalDressCode = merged.dressCode || inferDressCode(inferred.category, inferred.subcategory);
  const finalParking = merged.parking || inferParking(merged.address);
  const vibes = inferVibes(
    merged,
    empty$,
    inferred.category,
    inferred.subcategory,
    googleVibeSignals,
    googlePlace
      ? {
          priceLevel: googlePlace.priceLevel,
          amenities: googlePlace.amenities,
          parking: googlePlace.parking,
          userRatingCount: googlePlace.userRatingCount,
        }
      : undefined,
  );

  return {
    ...merged,
    imageUrls: merged.imageUrls || [],
    category: inferred.category,
    subcategory: inferred.subcategory.length > 0 ? inferred.subcategory : undefined,
    vibes: vibes.length > 0 ? vibes : undefined,
    neighborhood,
    priceRange: finalPriceRange,
    dressCode: finalDressCode,
    parking: finalParking,
  };
}

// --- URL-hint fast path -------------------------------------------------
// Used when the submitted URL was a Maps shortlink, Apple Maps, or
// Instagram link — the HTML scrape would return nothing useful, so we go
// straight to Google Places with whatever identifier the URL gave us.
async function scrapeFromUrlHint(
  hint: ResolvedUrlHint,
  options?: ScrapeOptions,
): Promise<ScrapedData> {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    // Without Places, the hint alone can't populate a record; return a
    // near-empty shell so the admin sees the submission and can edit.
    return {
      name: hint.query,
      website: hint.finalUrl,
      instagram: hint.instagramHandle,
      imageUrls: [],
    };
  }

  let googlePlace: GooglePlace | null = null;
  try {
    googlePlace = await findPlaceForScrape({
      name: hint.query,
      city: options?.city || "Miami",
      knownPlaceId: options?.knownPlaceId || hint.placeId,
      locationBias: hint.locationBias
        ? { lat: hint.locationBias.lat, lng: hint.locationBias.lng, radiusM: 5000 }
        : undefined,
    });
  } catch (err) {
    console.warn("findPlaceForScrape (URL hint) failed", err);
  }

  if (!googlePlace) {
    return {
      name: hint.query,
      website: hint.finalUrl,
      instagram: hint.instagramHandle,
      imageUrls: [],
    };
  }

  const merged: Partial<ScrapedData> = {
    name: googlePlace.name,
    // For Instagram submissions, the user's original URL is not a website —
    // leave website undefined (or use the venue's own website from Places).
    website: googlePlace.website,
    googlePlaceId: googlePlace.placeId,
    instagram: hint.instagramHandle,
  };

  if (googlePlace.lat && googlePlace.lng) {
    merged.lat = googlePlace.lat;
    merged.lng = googlePlace.lng;
  }
  if (googlePlace.phone) merged.phone = googlePlace.phone;
  if (googlePlace.address) merged.address = googlePlace.address;
  if (googlePlace.editorialSummary) merged.description = googlePlace.editorialSummary;

  const ghours = googleHoursString(googlePlace);
  if (ghours) merged.hours = ghours;

  const gprice = googlePriceLevelToDollars(googlePlace.priceLevel);
  if (gprice) merged.priceRange = gprice;

  const gparking = googleParkingString(googlePlace);
  if (gparking) merged.parking = gparking;

  // Photos — start with Google's curated set, then optionally backfill
  // from Instagram if we know the handle and Google came up light.
  const googlePhotoUrls = googlePlace.photos
    .map((p) => p.url)
    .filter((u): u is string => !!u);
  let imageUrls = [...googlePhotoUrls];
  if (hint.instagramHandle && imageUrls.length < 6) {
    const igPhotos = await fetchInstagramProfilePhotos(hint.instagramHandle, 6).catch(
      () => [] as string[],
    );
    // De-dupe by URL — Instagram URLs never collide with Google CDN URLs.
    const seen = new Set(imageUrls);
    for (const u of igPhotos) {
      if (!seen.has(u)) {
        imageUrls.push(u);
        seen.add(u);
      }
    }
  }
  merged.imageUrls = imageUrls;

  if (!merged.lat && !merged.lng && merged.address) {
    const geo = await geocodeAddress(merged.address);
    if (geo) {
      merged.lat = geo.lat;
      merged.lng = geo.lng;
    }
  }

  const googleTypes = googleTypeTokens(googlePlace);
  const googleVibeSignals = googleSignalText(googlePlace);
  const empty$ = cheerio.load("<html><body></body></html>");
  const inferred = inferSubcategories(merged, empty$, hint.finalUrl, googleTypes);

  const googleHood = googlePlace.addressComponents?.neighborhood;
  const neighborhood =
    googleHood && googleHood !== "City Center"
      ? googleHood
      : inferNeighborhood(merged.address, merged.description);

  const finalPriceRange = merged.priceRange || inferPriceRange(inferred.category, inferred.subcategory);
  const finalDressCode = merged.dressCode || inferDressCode(inferred.category, inferred.subcategory);
  const finalParking = merged.parking || inferParking(merged.address);
  const vibes = inferVibes(
    merged,
    empty$,
    inferred.category,
    inferred.subcategory,
    googleVibeSignals,
    googlePlace
      ? {
          priceLevel: googlePlace.priceLevel,
          amenities: googlePlace.amenities,
          parking: googlePlace.parking,
          userRatingCount: googlePlace.userRatingCount,
        }
      : undefined,
  );

  return {
    ...merged,
    imageUrls: merged.imageUrls || [],
    category: inferred.category,
    subcategory: inferred.subcategory.length > 0 ? inferred.subcategory : undefined,
    vibes: vibes.length > 0 ? vibes : undefined,
    neighborhood,
    priceRange: finalPriceRange,
    dressCode: finalDressCode,
    parking: finalParking,
  };
}
