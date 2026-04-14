import { CATEGORY_LABELS, Category } from "@/lib/types";

/**
 * Semantic search helpers. We embed via a Supabase Edge Function that wraps
 * the built-in `gte-small` model (384 dim, MIT-licensed). Free, no external
 * API key, runs inside the same Supabase project that owns the data.
 *
 * The Edge Function source lives at `supabase/functions/embed/index.ts` and
 * must be deployed once with `supabase functions deploy embed`.
 *
 * This module is server-only — do not import from client code; it uses the
 * service role key to authenticate against the function.
 */

const EMBEDDING_DIM = 384;

export type SpotLike = {
  name?: string | null;
  category?: Category[] | string[] | null;
  subcategory?: string[] | null;
  vibes?: string[] | null;
  neighborhood?: string | null;
  city?: string | null;
  description?: string | null;
};

/**
 * Build the text we embed for a spot. Order matters — putting the name and
 * category first biases the vector toward identity, which helps exact-intent
 * queries ("italian restaurant in brickell") without hurting vibe queries.
 */
export function buildSpotCorpus(spot: SpotLike): string {
  const parts: string[] = [];
  if (spot.name) parts.push(spot.name);
  if (spot.category && spot.category.length > 0) {
    const labels = (spot.category as Category[])
      .map((c) => CATEGORY_LABELS[c] ?? c)
      .filter(Boolean);
    if (labels.length) parts.push(labels.join(", "));
  }
  if (spot.subcategory && spot.subcategory.length > 0) {
    parts.push(spot.subcategory.join(", "));
  }
  if (spot.vibes && spot.vibes.length > 0) {
    parts.push(`Vibes: ${spot.vibes.join(", ")}`);
  }
  if (spot.neighborhood || spot.city) {
    parts.push([spot.neighborhood, spot.city].filter(Boolean).join(", "));
  }
  if (spot.description) parts.push(spot.description);
  return parts.join(". ").trim();
}

async function embed(text: string): Promise<number[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error("Supabase env vars not set (URL + service role key)");
  }

  const res = await fetch(`${baseUrl}/functions/v1/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Distinguish "function not deployed" (404) from runtime failures so
    // upstream callers can surface a useful hint.
    if (res.status === 404) {
      throw new Error("embed edge function not deployed");
    }
    throw new Error(`embed function failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as { embedding?: number[] };
  const vec = json.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding shape (len=${vec?.length})`);
  }
  return vec;
}

/** Embed a query string for semantic search. Short-circuits empty input. */
export async function embedQuery(query: string): Promise<number[] | null> {
  const clean = query.trim();
  if (!clean) return null;
  return embed(clean);
}

/**
 * Embed a spot's searchable text. Returns `null` if the corpus is empty so
 * callers can skip the update safely.
 */
export async function embedSpot(
  spot: SpotLike,
): Promise<{ embedding: number[]; source: string } | null> {
  const source = buildSpotCorpus(spot);
  if (!source) return null;
  const embedding = await embed(source);
  return { embedding, source };
}
