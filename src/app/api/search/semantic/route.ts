import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/embeddings";
import { parseSearchQuery, type SearchTaxonomy } from "@/lib/search-query-parser";

/**
 * Hybrid semantic search over spots. Runs alongside the substring filter in
 * the command menu; only fires when the substring path returns thin results.
 *
 * Contract:
 *   GET /api/search/semantic?q=some+intent+query
 *   → 200 { results: Array<{ id, similarity }>, meta?: { empty_reason } }
 *   → 400 if q is missing / too short
 *   → 401 if unauthenticated (the command menu is member-only)
 *   → 502 if the embed edge function errors or isn't deployed
 *
 * Architecture: structured pre-filter + vector rank. The query parser pulls
 * neighborhood, city, and category tokens out of the raw string against the
 * live DB taxonomy; those become hard constraints on the RPC. Everything
 * that's left is embedded and used to fuzzy-rank within the filtered subset.
 * This keeps dense-vector noise contained — "drinks in wynwood" with no
 * Wynwood bars returns zero results, not a Brickell bar whose vector happens
 * to live nearby. See src/lib/search-query-parser.ts for the rationale.
 */

// Module-level cache so we don't round-trip the taxonomy on every keystroke.
// Cheap even at thousands of spaces; eviction on a 10-minute TTL keeps new
// neighborhoods discoverable without a deploy.
const TAXONOMY_TTL_MS = 10 * 60 * 1000;
let taxonomyCache: { value: SearchTaxonomy; expires: number } | null = null;

async function loadTaxonomy(): Promise<SearchTaxonomy> {
  const now = Date.now();
  if (taxonomyCache && taxonomyCache.expires > now) return taxonomyCache.value;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spots")
    .select("neighborhood, city");

  if (error || !data) {
    // Fall back to an empty taxonomy — parser degrades to category-only
    // matching, which still works and avoids spurious 500s if the DB blips.
    return { neighborhoods: [], cities: [] };
  }

  const neighborhoods = Array.from(
    new Set(data.map((r) => r.neighborhood).filter(Boolean) as string[]),
  );
  const cities = Array.from(
    new Set(data.map((r) => r.city).filter(Boolean) as string[]),
  );
  const value = { neighborhoods, cities };
  taxonomyCache = { value, expires: now + TAXONOMY_TTL_MS };
  return value;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3) {
    return NextResponse.json({ error: "query too short" }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "query too long" }, { status: 400 });
  }

  const taxonomy = await loadTaxonomy();
  const parsed = parseSearchQuery(q, taxonomy);

  // Always embed the full original query — filters narrow the candidate set,
  // and the vector just ranks within it. Using the raw query (not `freeText`)
  // keeps the embedding model's signal intact even when the parser has
  // stripped out most of the input; ranking a filtered set of 3–5 candidates
  // by a slightly noisy vector is fine.
  const embedText = q;

  let vector: number[] | null = null;
  try {
    vector = await embedQuery(embedText);
  } catch (err) {
    console.error("embedQuery failed:", err);
    const message = err instanceof Error ? err.message : "embedding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (!vector) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_spots", {
    query_embedding: vector as unknown as string,
    match_count: 8,
    min_similarity: 0.3,
    filter_neighborhoods: parsed.neighborhoods.length
      ? parsed.neighborhoods
      : null,
    filter_cities: parsed.cities.length ? parsed.cities : null,
    filter_categories: parsed.categories.length ? parsed.categories : null,
  });

  if (error) {
    console.error("match_spots RPC failed:", error);
    const hint = /match_spots|function|vector|does not exist/i.test(error.message)
      ? "migration not applied"
      : "search failed";
    return NextResponse.json(
      { error: hint, detail: error.message },
      { status: 500 },
    );
  }

  const results = data ?? [];
  return NextResponse.json({
    results,
    // When filters narrowed to nothing, say so explicitly — distinguishes
    // "we searched and there's no match for your constraints" from "setup
    // problem" and from "the vector model didn't find anything close."
    meta: results.length === 0
      ? {
          empty_reason: parsed.hasFilters ? "no_matches_in_filter" : "no_matches",
          filters: parsed.hasFilters
            ? {
                neighborhoods: parsed.neighborhoods,
                cities: parsed.cities,
                categories: parsed.categories,
              }
            : undefined,
        }
      : undefined,
  });
}
