import type { Category } from "@/lib/types";

/**
 * Query parser for hybrid search. Extracts structured filters (neighborhood,
 * city, category) from a free-form search string so the semantic RPC can
 * enforce them as hard constraints before vector ranking runs.
 *
 * Why this exists: dense-vector similarity is fuzzy ranking, not filtering.
 * `gte-small` embeds "drinks in wynwood" and "drinks in brickell" into nearly
 * identical vectors — neighborhood is a weak hint, not a constraint. Asking
 * pgvector alone to honor it means either (a) brittle threshold tuning that
 * ages as the catalog grows, or (b) false positives like "here's a Brickell
 * bar, you said Wynwood, close enough."
 *
 * Architecture: this parser is tier 1 (dictionary lookup against DB-derived
 * neighborhoods + a static category synonym table + grammar extraction for
 * unknown locations). Good up to a few hundred spaces. When we outgrow it
 * (synonym explosion, misspellings, multi-word vibes), swap the body of
 * `parseSearchQuery` for an LLM-backed parser that returns the same shape —
 * everything downstream stays identical.
 */

export type ParsedQuery = {
  /** Structured filters the RPC will enforce as hard constraints. */
  neighborhoods: string[];
  cities: string[];
  categories: Category[];
  /** Tokens the parser didn't recognize — fed to the embedding model. */
  freeText: string;
  /** True if the parser extracted any structured filter. */
  hasFilters: boolean;
};

/**
 * Category synonyms. Conservative by design — only high-confidence tokens are
 * mapped. Ambiguous words ("club", which could mean nightlife or a members
 * club) are omitted so the vector ranker can sort them out instead of the
 * filter hard-dropping valid hits.
 *
 * Order of keys doesn't matter; tokens are matched case-insensitively with
 * word boundaries so "bar" doesn't match inside "barbecue".
 */
const CATEGORY_SYNONYMS: Record<Category, string[]> = {
  dining: [
    "dining", "dine", "eat", "eats", "food", "meal", "restaurant", "restaurants",
    "dinner", "lunch", "breakfast",
  ],
  drinks: [
    "drinks", "drink", "drinking",
    "bar", "bars", "cocktail", "cocktails",
    "nightlife", "nightclub", "nightclubs",
    "lounge", "lounges", "speakeasy", "speakeasies",
    "wine", "wines", "beer", "beers", "mezcal", "sake",
  ],
  coffee: [
    "coffee", "cafe", "cafes", "café", "cafés",
    "espresso", "latte", "matcha", "tea",
    "bakery", "bakeries", "pastry", "pastries",
  ],
  wellness: [
    "wellness", "gym", "gyms", "fitness", "workout", "workouts",
    "spa", "spas", "sauna", "saunas", "yoga", "pilates",
    "recovery", "massage", "massages", "facial", "facials",
    "salon", "salons", "barbershop", "barber",
  ],
  shopping: [
    "shopping", "shop", "shops", "store", "stores",
    "boutique", "boutiques", "retail",
  ],
  members: [
    "members", "member", "coworking",
  ],
  hotels: [
    "hotels", "hotel", "stay", "stays", "resort", "resorts",
    "lodging", "accommodation",
  ],
};

/** Flattened synonym → category lookup, built once per module load. */
const SYNONYM_TO_CATEGORY: Map<string, Category> = (() => {
  const m = new Map<string, Category>();
  for (const [cat, words] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const w of words) m.set(w.toLowerCase(), cat as Category);
  }
  return m;
})();

/** Prepositions that syntactically mark their object as a location. */
const LOCATION_PREPOSITIONS = ["in", "near", "at", "around", "by"];

/** Words that halt a location phrase from expanding further. */
const PHRASE_STOPPERS = new Set([
  ...LOCATION_PREPOSITIONS,
  "with", "for", "and", "or", "but", "the", "a", "an",
]);

const STOPWORDS = new Set([
  "in", "at", "near", "the", "a", "an", "for", "around", "by", "with", "of",
]);

export type SearchTaxonomy = {
  /** Distinct neighborhood strings, as stored in `spots.neighborhood`. */
  neighborhoods: string[];
  /** Distinct city strings, as stored in `spots.city`. */
  cities: string[];
};

/**
 * Parse a free-form search query against the live taxonomy. Three passes:
 *
 *   1. Phrase-match known neighborhoods and cities (longest first) so
 *      "Design District" isn't split apart by "district" matching something
 *      else. Case-insensitive.
 *   2. Token-match category synonyms ("bar" → drinks, "gym" → wellness).
 *   3. Grammar extraction: whatever follows "in|near|at|around|by" in the
 *      residual is treated as an *unknown* neighborhood filter. This is
 *      what makes "drinks in wynwood" correctly return empty when Wynwood
 *      has no spaces — the SQL WHERE applies the filter, gets zero rows,
 *      and we surface that as "no matches" rather than silently falling
 *      back to the full catalog.
 *
 * What's left after all three passes becomes `freeText` — fed to the
 * embedding model for fuzzy ranking within the filtered subset.
 */
export function parseSearchQuery(
  query: string,
  taxonomy: SearchTaxonomy,
): ParsedQuery {
  const original = query.trim();
  if (!original) {
    return {
      neighborhoods: [],
      cities: [],
      categories: [],
      freeText: "",
      hasFilters: false,
    };
  }

  // Work on a padded lowercased copy so `\b`-style matches work cleanly at
  // the string edges without a lot of special-casing.
  let residual = ` ${original.toLowerCase()} `;

  const matchedNeighborhoods: string[] = [];
  const matchedCities: string[] = [];
  const matchedCategories = new Set<Category>();

  // Pass 1 — phrase-match known neighborhoods and cities, longest first.
  const phraseTargets: Array<{ kind: "n" | "c"; value: string }> = [
    ...taxonomy.neighborhoods.map((v) => ({ kind: "n" as const, value: v })),
    ...taxonomy.cities.map((v) => ({ kind: "c" as const, value: v })),
  ].sort((a, b) => b.value.length - a.value.length);

  for (const { kind, value } of phraseTargets) {
    const needle = value.toLowerCase();
    const re = new RegExp(
      `(?<=[\\s])${escapeRegex(needle)}(?=[\\s,.!?])`,
      "g",
    );
    if (residual.match(re)) {
      if (kind === "n" && !matchedNeighborhoods.includes(value)) {
        matchedNeighborhoods.push(value);
      } else if (kind === "c" && !matchedCities.includes(value)) {
        matchedCities.push(value);
      }
      residual = residual.replace(re, " ");
    }
  }

  // Pass 2 — category synonyms.
  for (const [syn, cat] of SYNONYM_TO_CATEGORY) {
    const re = new RegExp(`(?<=[\\s])${escapeRegex(syn)}(?=[\\s,.!?])`, "g");
    if (residual.match(re)) {
      matchedCategories.add(cat);
      residual = residual.replace(re, " ");
    }
  }

  // Pass 3 — grammar extraction of unknown locations. A phrase like "in
  // wynwood" after the category strip means the user is naming a place we
  // don't have in our taxonomy. Treat it as a hard filter anyway so the RPC
  // returns 0 instead of the full unfiltered catalog.
  const prepPattern = LOCATION_PREPOSITIONS.map(escapeRegex).join("|");
  const locRe = new RegExp(
    `(?<=\\s)(?:${prepPattern})\\s+([a-z][a-z\\-]*(?:\\s+[a-z][a-z\\-]*){0,2})(?=\\s|$)`,
    "gi",
  );
  for (const m of residual.matchAll(locRe)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    // Trim trailing stoppers ("in the design district" → strip leading "the").
    const words = raw.split(/\s+/).filter((w) => !PHRASE_STOPPERS.has(w));
    const loc = words.join(" ");
    if (!loc) continue;
    // Skip if we already captured this (or a superset) as a known neighborhood.
    const already = matchedNeighborhoods.some(
      (n) => n.toLowerCase() === loc || n.toLowerCase().includes(loc),
    );
    if (already) continue;
    // Normalize display-case: lowercase is fine for the RPC since filters
    // compare lower-vs-lower.
    matchedNeighborhoods.push(loc);
  }
  // Strip the matched location preposition phrases from residual after the
  // loop so regex state doesn't interfere with matchAll.
  residual = residual.replace(locRe, " ");

  const freeText = residual
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .join(" ")
    .trim();

  const categories = Array.from(matchedCategories);
  return {
    neighborhoods: matchedNeighborhoods,
    cities: matchedCities,
    categories,
    freeText,
    hasFilters:
      matchedNeighborhoods.length > 0 ||
      matchedCities.length > 0 ||
      categories.length > 0,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
