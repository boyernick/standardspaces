// Perplexity-powered venue research. Replaces the Google-Places + HTML-only
// pipeline with a single Sonar Pro call that synthesizes the venue's own
// site, Instagram, Resy, Eater/Timeout, Yelp, etc. into a structured JSON
// payload matching the admin form's schema.
//
// Image bytes are *not* sourced here — Perplexity's citations point at
// pages, not image files. The caller runs `extractImagesFromUrl` in parallel
// for that. See src/lib/scraper.ts.

import { CATEGORY_ORDER, SUBCATEGORIES, VIBES } from "./types";
import { DRESS_CODES, MIAMI_NEIGHBORHOODS, PARKING_OPTIONS, PRICE_RANGES } from "@/components/admin/form";

// Shape of what `researchVenue` returns. Mirrors the text fields of the
// previous `ScrapedData` so downstream code (route handlers, admin form)
// doesn't need changes.
export interface ResearchedData {
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
  instagram?: string;
  lat?: number;
  lng?: number;
  category?: string[];
  subcategory?: string[];
  vibes?: string[];
  /**
   * Third-party image URLs Perplexity surfaced from Instagram/Yelp/Resy/
   * editorial coverage. Used as a fallback when the venue's own HTML doesn't
   * render images server-side (SPAs, JS-hydrated WordPress sites, etc.).
   * Expect some of these to 403 on download — `processPhotos` tolerates
   * per-URL failures.
   */
  imageUrls?: string[];
}

export interface ResearchResult {
  data: ResearchedData;
  sources: string[];
}

export class ResearchError extends Error {
  httpStatus: number;
  constructor(status: number, message: string) {
    super(`Perplexity research failed (${status}): ${message}`);
    this.name = "ResearchError";
    this.httpStatus = status;
  }
}

export interface ResearchOptions {
  /** City slug or name used to anchor the venue search (defaults to Miami). */
  city?: string;
  /** Optional venue name hint from the user's submission; helps disambiguate
   *  for URLs behind bot walls or redirects. */
  knownName?: string;
}

// Flatten the per-category subcategory lists into a single union enum. The
// admin form accepts any entry from any category, so Perplexity picking
// cross-category is fine — the category field narrows the UI context.
const ALL_SUBCATEGORIES = Array.from(
  new Set(CATEGORY_ORDER.flatMap((c) => SUBCATEGORIES[c] ?? [])),
);

const DEFAULT_MODEL = "sonar-pro";
const ENDPOINT = "https://api.perplexity.ai/chat/completions";
// Sonar Pro + citations + web search can run 20–60s. Generous timeout so
// slow citations don't kill the request; we still return well inside the
// Vercel function limit.
const TIMEOUT_MS = 90_000;

function buildSystemPrompt(): string {
  return [
    "You are a venue research analyst producing structured JSON about a hospitality space.",
    "You will be given the venue's primary URL and optional hints. Research the web — the venue's own site, Instagram, Resy/OpenTable, Eater/Timeout/Infatuation, Yelp, Reddit — and return a single JSON object that conforms to the provided JSON schema.",
    "",
    "Formatting rules:",
    "- All labels/tags use title case. Never use ALL CAPS in any field.",
    "- In any prose (e.g. `description`), call it a \"space\", not a \"spot\".",
    "- `description` is 1–3 sentences, editorial in tone, no marketing fluff.",
    "- `hours` is one weekday per line in the format `Monday 5PM–11PM`. Use an en-dash (–) between times, not a hyphen. Use `Closed` as the entire value for days the venue is closed, e.g. `Monday Closed`.",
    "- **Multi-service-window days**: if a day has more than one service window (e.g. lunch + dinner, brunch + dinner, breakfast + lunch), include ALL windows on that same line, comma-separated. Example: `Monday 11:30AM–3PM, 5PM–10:30PM`. Never truncate to only one window.",
    "- Do not return hours as a single block like `Daily 11AM–11PM` unless the venue is genuinely open continuously with no break every day.",
    "- `priceRange` is exactly one of $, $$, $$$, $$$$.",
    "- `phone` is digits with formatting like `(305) 555-1234` — US-style when in the US.",
    "- `instagram` is the handle only — just the username, no @ prefix, no URL, no `instagram.com/`. Search the venue's site footer, Linktree, Contact page, and social profiles to find it. If the venue has both a main and a location-specific handle (e.g. a group with a Miami outpost), prefer the location-specific one.",
    "- `imageUrls` is an array of 4–8 **direct** image URLs (strings ending in .jpg/.jpeg/.png/.webp) showing the venue's interior, food/drinks, exterior, or ambiance. Source these from the venue's Instagram posts, Yelp gallery, Resy/OpenTable listings, Google Maps photos, or editorial coverage (Eater/Timeout/Infatuation). Do NOT return page URLs — return the image file URL itself. Prefer landscape orientation and professional/editorial photos over user snapshots when both are available. Skip logos, headshots, and staff photos.",
    "- `lat`/`lng` are decimal degrees with at least 4 decimal places of precision.",
    "- `bookingPlatform` is one of: Resy, OpenTable, Tock, SevenRooms, Yelp, or the venue's name if in-house.",
    "- `website` is the venue's canonical homepage URL.",
    "- Arrays: return between 1 and 4 items where the schema allows multiple. Prefer the most specific label.",
    "- If you cannot confidently determine a field, omit it entirely rather than guess.",
    "",
    "Vocabulary constraints — use only these values (title case, exact match):",
    `- category: one or more of ${JSON.stringify(CATEGORY_ORDER)}.`,
    `- subcategory: one or more of ${JSON.stringify(ALL_SUBCATEGORIES)}.`,
    `- vibes: one or more of ${JSON.stringify(VIBES)}.`,
    `- neighborhood (Miami venues only): one of ${JSON.stringify(MIAMI_NEIGHBORHOODS)}. Omit for other cities.`,
    `- priceRange: one of ${JSON.stringify(PRICE_RANGES)}.`,
    `- dressCode: one of ${JSON.stringify(DRESS_CODES)}.`,
    `- parking: one of ${JSON.stringify(PARKING_OPTIONS)}.`,
  ].join("\n");
}

function buildUserPrompt(url: string, options: ResearchOptions): string {
  const lines = [
    `Research this venue and return the JSON object per the schema.`,
    `Primary URL: ${url}`,
  ];
  if (options.knownName) lines.push(`Known name hint: ${options.knownName}`);
  lines.push(`City: ${options.city || "Miami"}`);
  lines.push(
    "",
    "Prioritize facts that appear on the venue's own site or verified profiles (Resy, Instagram, Google Business). Cross-check hours and address across at least two sources if possible. Return only the JSON — no commentary.",
  );
  return lines.join("\n");
}

// JSON schema matching ResearchedData. Perplexity enforces this server-side
// via `response_format: { type: "json_schema", ... }`, so we don't need to
// regex-salvage free text. Keep this in sync with ResearchedData above.
function buildResponseSchema() {
  return {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      address: { type: "string" },
      neighborhood: { type: "string" },
      phone: { type: "string" },
      website: { type: "string" },
      hours: { type: "string" },
      priceRange: { type: "string", enum: PRICE_RANGES },
      dressCode: { type: "string", enum: DRESS_CODES },
      parking: { type: "string", enum: PARKING_OPTIONS },
      bookingUrl: { type: "string" },
      bookingPlatform: { type: "string" },
      menuUrl: { type: "string" },
      instagram: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
      category: {
        type: "array",
        items: { type: "string", enum: CATEGORY_ORDER },
        minItems: 1,
        maxItems: 3,
      },
      subcategory: {
        type: "array",
        items: { type: "string", enum: ALL_SUBCATEGORIES },
        maxItems: 4,
      },
      vibes: {
        type: "array",
        items: { type: "string", enum: VIBES },
        maxItems: 6,
      },
      imageUrls: {
        type: "array",
        items: { type: "string" },
        maxItems: 8,
      },
    },
    additionalProperties: false,
  };
}

// Narrow payload shape from Perplexity's response. Only parses the fields
// we actually read; ignores token usage, id, model, etc.
interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  citations?: string[];
  // Newer API versions return `search_results: [{ url, title, date }]`.
  search_results?: Array<{ url?: string }>;
}

function extractSources(payload: PerplexityResponse): string[] {
  const urls: string[] = [];
  if (Array.isArray(payload.citations)) {
    for (const c of payload.citations) {
      if (typeof c === "string" && c.startsWith("http")) urls.push(c);
    }
  }
  if (Array.isArray(payload.search_results)) {
    for (const r of payload.search_results) {
      if (r && typeof r.url === "string" && r.url.startsWith("http")) urls.push(r.url);
    }
  }
  // Dedupe while preserving order.
  return Array.from(new Set(urls));
}

export async function researchVenue(
  url: string,
  options: ResearchOptions = {},
): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new ResearchError(500, "PERPLEXITY_API_KEY is not set");
  }

  const model = process.env.PERPLEXITY_MODEL || DEFAULT_MODEL;

  const body = {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(url, options) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { schema: buildResponseSchema() },
    },
    // Lower temperature → more deterministic factual output.
    temperature: 0.1,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    throw new ResearchError(0, `network error: ${message}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ResearchError(res.status, text.slice(0, 500) || res.statusText);
  }

  const payload = (await res.json()) as PerplexityResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new ResearchError(502, "Perplexity returned no content");
  }

  let parsed: ResearchedData;
  try {
    parsed = JSON.parse(content) as ResearchedData;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ResearchError(502, `invalid JSON from Perplexity: ${message}`);
  }

  const sources = extractSources(payload);
  return { data: sanitize(parsed), sources };
}

// Defensive sanitation. Even with a JSON schema enforced server-side, trim
// strings and drop empty-string fields so downstream `|| null` coalescing
// behaves.
function sanitize(data: ResearchedData): ResearchedData {
  const out: ResearchedData = {};
  const stringKeys: (keyof ResearchedData)[] = [
    "name",
    "description",
    "address",
    "neighborhood",
    "phone",
    "website",
    "hours",
    "priceRange",
    "dressCode",
    "parking",
    "bookingUrl",
    "bookingPlatform",
    "menuUrl",
    "instagram",
  ];
  for (const k of stringKeys) {
    const v = data[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) (out as Record<string, unknown>)[k] = trimmed;
    }
  }
  if (typeof data.lat === "number" && Number.isFinite(data.lat)) out.lat = data.lat;
  if (typeof data.lng === "number" && Number.isFinite(data.lng)) out.lng = data.lng;
  if (Array.isArray(data.category)) {
    out.category = data.category.filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  if (Array.isArray(data.subcategory)) {
    out.subcategory = data.subcategory.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
  }
  if (Array.isArray(data.vibes)) {
    out.vibes = data.vibes.filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  if (Array.isArray(data.imageUrls)) {
    out.imageUrls = data.imageUrls.filter(
      (s): s is string => typeof s === "string" && /^https?:\/\//i.test(s),
    );
  }
  // Strip leading @ on instagram if the model forgot.
  if (out.instagram && out.instagram.startsWith("@")) {
    out.instagram = out.instagram.slice(1);
  }
  return out;
}
