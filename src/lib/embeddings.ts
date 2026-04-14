import { CATEGORY_LABELS, Category } from "@/lib/types";

/**
 * Semantic search helpers. We use OpenAI text-embedding-3-small (1536 dim)
 * because it's cheap (~$0.02/1M tokens), fast, and good enough for a
 * catalog-sized corpus. Matches the vector(1536) column in migration 012.
 *
 * All calls require OPENAI_API_KEY. This is a server-only module — never
 * import it from client code.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as { data?: { embedding: number[] }[] };
  const vec = json.data?.[0]?.embedding;
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
