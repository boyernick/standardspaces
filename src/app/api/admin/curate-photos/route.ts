import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";
import {
  MAX_CANDIDATES,
  MIN_CANDIDATES,
  coverageGaps,
  scoreCandidates,
  selectBalanced,
  type CandidateInput,
} from "@/lib/photo-curation";
import { AnthropicError } from "@/lib/anthropic";

// Admin-triggered photo curation. Runs a batched Claude Sonnet 4.6 call
// over the recommendation's existing scraped_images, then picks a balanced
// coverage set via the rules-based selector. Writes `scraped_data.curation`
// as provenance but does NOT mutate scraped_images — the admin confirms or
// overrides in the modal, and the selection only lands on publish.

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;

  try {
    const supabase = createAdminClient();
    const { recommendationId } = (await req.json()) as {
      recommendationId?: string;
    };
    if (!recommendationId) {
      return NextResponse.json(
        { error: "Missing recommendationId", stage: "validate" },
        { status: 400 },
      );
    }

    const { data: rec, error: fetchErr } = await supabase
      .from("recommendations")
      .select("id, scraped_data, scraped_images, category")
      .eq("id", recommendationId)
      .single();
    if (fetchErr || !rec) {
      return NextResponse.json(
        { error: "Recommendation not found", stage: "load" },
        { status: 404 },
      );
    }

    const scrapedData = (rec.scraped_data ?? {}) as Record<string, unknown>;
    const scrapedImages = Array.isArray(rec.scraped_images) ? (rec.scraped_images as string[]) : [];

    // Categories come from either the recommendation row or the scrape.
    // The admin form stores them as an array on `recommendations.category`
    // or under `scraped_data.category` — normalize both here.
    const categories = normalizeCategories(rec.category, scrapedData.category);

    if (scrapedImages.length < MIN_CANDIDATES) {
      return NextResponse.json(
        {
          warning: "insufficient_pool",
          stage: "pool",
          poolSize: scrapedImages.length,
          message:
            "Not enough photos to curate from. Re-scrape this listing to refresh the photo pool.",
        },
        { status: 200 },
      );
    }

    // Dedupe by URL — near-duplicate content isn't collapsed here (that's
    // a future pHash pass), but obvious identical URLs are.
    const uniqueUrls = Array.from(new Set(scrapedImages));
    const pool: CandidateInput[] = uniqueUrls
      .slice(0, MAX_CANDIDATES)
      .map((url) => ({ url, source: "scraped_places" as const }));

    // Run the scorer — one batched multimodal call.
    const scoreResult = await scoreCandidates(pool, categories);

    // Selector is pure + synchronous.
    const selected = selectBalanced(scoreResult.scored, categories);
    const gaps = coverageGaps(selected, categories);

    // Persist provenance. `scraped_data` is jsonb so we can add arbitrary
    // keys without a migration. The modal doesn't read this — it's for
    // auditing later.
    const ranAt = new Date().toISOString();
    const curation = {
      ranAt,
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      tokenCost: scoreResult.tokenCost,
      categories,
      coverageGaps: gaps,
      candidates: scoreResult.scored.map((c) => ({
        url: c.url,
        role: c.role,
        composite: c.composite,
        source: c.source,
      })),
      selected: selected.map((s) => s.url),
    };
    await supabase
      .from("recommendations")
      .update({ scraped_data: { ...scrapedData, curation } })
      .eq("id", recommendationId);

    return NextResponse.json({
      candidates: scoreResult.scored,
      selected: selected.map((s) => s.url),
      coverageGaps: gaps,
      ranAt,
      tokenCost: scoreResult.tokenCost,
      usage: scoreResult.usage,
    });
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error("Curate-photos Anthropic error:", err);
      return NextResponse.json(
        { error: err.message, stage: err.stage },
        { status: err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502 },
      );
    }
    console.error("Curate-photos error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Curation failed", stage: "unknown", detail: message },
      { status: 500 },
    );
  }
}

/**
 * Normalize category from either the recommendation row (legacy single
 * string, now often an array) or scraped_data (array from research.ts).
 * Returns lowercased category slugs matching CATEGORY_ORDER.
 */
function normalizeCategories(raw: unknown, scraped: unknown): string[] {
  const candidates: unknown[] = [];
  if (Array.isArray(raw)) candidates.push(...raw);
  else if (typeof raw === "string" && raw) candidates.push(raw);
  if (Array.isArray(scraped)) candidates.push(...scraped);
  else if (typeof scraped === "string" && scraped) candidates.push(scraped);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const slug = c.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
