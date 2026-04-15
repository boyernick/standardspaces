/**
 * Recognize Maps / Apple Maps / Instagram URLs that the HTML scraper can't
 * meaningfully parse (they're JS-rendered or bot-walled) and turn them into
 * Google Places search inputs.
 *
 * The submission pipeline for these URLs used to fall through to the raw
 * HTML path, get an empty page, and return a mostly-blank record to the
 * admin. This module short-circuits that: if we can pull a `placeId`, a
 * name query, or a lat/lng out of the URL, the scraper uses Google Places
 * as the authoritative source instead of scraping blank HTML.
 */
export interface ResolvedUrlHint {
  /** Final URL after following redirects. Always set. */
  finalUrl: string;
  /** Google Places place ID, if one could be extracted from the URL. */
  placeId?: string;
  /** Fallback text-search query (venue name) when no place ID is available. */
  query?: string;
  /** Coordinates for location-biasing the Places search. */
  locationBias?: { lat: number; lng: number };
  /** Instagram handle (with @) if the URL was an Instagram profile/post. */
  instagramHandle?: string;
  /** True if this URL matched a handler (vs. being a generic website). */
  matched: boolean;
}

/** Expand a Maps short-link to its final URL. Best-effort. */
async function expandShortLink(url: string): Promise<string> {
  try {
    const res = await fetch(url, { redirect: "follow", method: "GET" });
    return res.url || url;
  } catch {
    return url;
  }
}

/** Extract lat/lng from a `@lat,lng,zoom` fragment of a google.com/maps URL. */
function parseAtCoords(url: string): { lat: number; lng: number } | undefined {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return undefined;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

/** Extract the `/place/{name}/…` segment as a human-readable query. */
function parsePlaceName(url: string): string | undefined {
  const m = url.match(/\/maps\/place\/([^/@]+)/);
  if (!m) return undefined;
  return decodeURIComponent(m[1]).replace(/\+/g, " ").trim() || undefined;
}

/**
 * Google encodes the Places feature ID inside `data=!...!1s0x...:0x...!` on
 * every maps.google URL. It's the same ftid the new Places v1 API accepts
 * as `places/{ftid}` — much stronger than a text-search guess.
 */
function parseFtid(url: string): string | undefined {
  const m = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return m?.[1];
}

async function resolveGoogleMaps(url: string): Promise<ResolvedUrlHint> {
  const expanded = await expandShortLink(url);
  const ftid = parseFtid(expanded);
  const coords = parseAtCoords(expanded);
  const name = parsePlaceName(expanded);
  return {
    finalUrl: expanded,
    placeId: ftid,
    query: ftid ? undefined : name,
    locationBias: coords,
    matched: true,
  };
}

function resolveAppleMaps(url: string): ResolvedUrlHint {
  let query: string | undefined;
  let locationBias: { lat: number; lng: number } | undefined;
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("name");
    if (q) query = decodeURIComponent(q).replace(/\+/g, " ").trim();
    const ll = u.searchParams.get("ll") || u.searchParams.get("sll");
    if (ll) {
      const [lat, lng] = ll.split(",").map((s) => parseFloat(s.trim()));
      if (isFinite(lat) && isFinite(lng)) locationBias = { lat, lng };
    }
  } catch {
    // fall through
  }
  return { finalUrl: url, query, locationBias, matched: true };
}

/**
 * Turn an Instagram handle slug into a Google Places search query.
 * `lionsden_miami` → "lions den miami". Splits on `_` and `.`, plus a
 * camelCase boundary so handles like `MaryLouMiami` come out cleanly.
 * Trailing two-letter state codes ("nyc", "mia") are kept since they help
 * disambiguate; the city name appended downstream by the caller stays too.
 */
function humanizeHandle(slug: string): string {
  return slug
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Best-effort fetch of the Instagram profile's og:title. Format is usually
 * `Real Name (@handle) • Instagram photos and videos`, which gives us the
 * venue's actual display name — far better than the raw handle for a
 * Places text search (handle "lionsden_miami" → display "The Lion's Den").
 */
async function fetchInstagramProfileName(handle: string): Promise<string | undefined> {
  const clean = handle.replace(/^@/, "").replace(/\/+$/, "");
  if (!clean) return undefined;
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const titleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    );
    const raw = titleMatch?.[1];
    if (!raw) return undefined;
    // Strip the trailing " (@handle) • Instagram photos and videos" tail.
    const cleaned = raw
      .replace(/\s*[•·]\s*Instagram.*$/i, "")
      .replace(/\s*\(@[^)]+\)\s*$/i, "")
      .trim();
    if (!cleaned || cleaned.toLowerCase() === clean.toLowerCase()) return undefined;
    return cleaned;
  } catch {
    return undefined;
  }
}

async function resolveInstagram(url: string): Promise<ResolvedUrlHint> {
  // Profile URLs: instagram.com/{handle}/ (also /{handle}?...)
  // Post URLs: instagram.com/p/{code}/ or /reel/{code}/ — handle not exposed
  try {
    const u = new URL(url);
    const [, seg1] = u.pathname.split("/");
    if (!seg1) return { finalUrl: url, matched: true };
    const reserved = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts"]);
    if (reserved.has(seg1.toLowerCase())) {
      // Post URL — no handle in the path. Let the scraper extract what it can.
      return { finalUrl: url, matched: true };
    }
    const slug = seg1.replace(/\/+$/, "");
    const handle = `@${slug}`;
    // Prefer the og:title display name; fall back to a humanized slug.
    const profileName = await fetchInstagramProfileName(slug);
    const query = profileName || humanizeHandle(slug);
    return {
      finalUrl: url,
      query,
      instagramHandle: handle,
      matched: true,
    };
  } catch {
    return { finalUrl: url, matched: true };
  }
}

/**
 * Inspect a submitted URL and return hints for the Google Places enrichment
 * path. If the URL is a generic website (not maps/apple/instagram), returns
 * `{ matched: false }` and the caller falls through to the normal HTML
 * scrape.
 */
export async function resolveUrlToPlace(url: string): Promise<ResolvedUrlHint> {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { finalUrl: url, matched: false };
  }

  // Google Maps — long and short forms
  if (
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "maps.google.com" ||
    host === "www.google.com" ||
    host === "google.com"
  ) {
    if (host === "google.com" || host === "www.google.com") {
      // Only treat google.com as Maps when the path starts with /maps
      if (!new URL(url).pathname.startsWith("/maps")) {
        return { finalUrl: url, matched: false };
      }
    }
    return resolveGoogleMaps(url);
  }

  // Apple Maps
  if (host === "maps.apple.com") {
    return resolveAppleMaps(url);
  }

  // Instagram
  if (host === "instagram.com" || host === "instagr.am") {
    return resolveInstagram(url);
  }

  // Reservation platforms — bot-wall direct fetches, but the slug is a
  // near-perfect search query that Google Places resolves cleanly.
  if (
    host === "opentable.com" ||
    host === "resy.com" ||
    host === "exploretock.com" ||
    host === "sevenrooms.com"
  ) {
    return resolveReservationPlatform(url);
  }

  return { finalUrl: url, matched: false };
}

/**
 * Turn a reservation-platform URL into a text-search query by decoding the
 * restaurant slug. Examples:
 *  - opentable.com/zuma-japanese-restaurant-miami → "zuma japanese restaurant miami"
 *  - opentable.com/r/mary-lous-miami → "mary lous miami"
 *  - resy.com/cities/miami-fl/venues/carbone → "carbone miami"
 *  - exploretock.com/kikis-on-the-river → "kikis on the river"
 */
function resolveReservationPlatform(url: string): ResolvedUrlHint {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // Strip known routing prefixes.
    const skip = new Set(["r", "cities", "venues", "restaurant", "restaurants"]);
    const slugs = parts.filter((p) => !skip.has(p.toLowerCase()));
    // The last non-routing segment is the venue slug. Earlier segments (when
    // present on Resy) often encode the city as `miami-fl` — use them as
    // query context so Google Places gets enough to disambiguate.
    const rawSlug = slugs[slugs.length - 1] || "";
    const citySlug = slugs.length > 1 ? slugs[slugs.length - 2] : "";
    const slugToWords = (s: string) =>
      decodeURIComponent(s).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    const venue = slugToWords(rawSlug);
    const cityWords = slugToWords(citySlug)
      // Strip trailing two-letter state code (e.g. "miami fl" → "miami")
      .replace(/\s+[a-z]{2}$/i, "")
      .trim();
    const query = [venue, cityWords].filter(Boolean).join(" ").trim() || undefined;
    return {
      finalUrl: url,
      query,
      matched: !!query,
    };
  } catch {
    return { finalUrl: url, matched: false };
  }
}

/**
 * Best-effort fetch of the first few image thumbnails off a public Instagram
 * profile page. Instagram's markup is hostile and changes — this is wrapped
 * in a try/catch by every caller so a failure degrades gracefully to
 * Google-only photos.
 */
export async function fetchInstagramProfilePhotos(
  handle: string,
  limit = 6,
): Promise<string[]> {
  const clean = handle.replace(/^@/, "").replace(/\/+$/, "");
  if (!clean) return [];
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        // Instagram sometimes returns a minimal HTML shell without this.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Instagram's SSR HTML embeds high-res image URLs in og:image and in the
    // inline `display_url` fields of their JSON blob. Pull both.
    const urls = new Set<string>();
    for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
      urls.add(m[1]);
    }
    for (const m of html.matchAll(/"display_url":"([^"]+)"/g)) {
      // JSON-escaped forward slashes
      urls.add(m[1].replace(/\\\//g, "/"));
    }
    return Array.from(urls).slice(0, limit);
  } catch {
    return [];
  }
}
