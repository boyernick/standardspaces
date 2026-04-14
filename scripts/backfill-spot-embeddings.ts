/**
 * One-shot backfill for spot embeddings. Run after migration 012 has been
 * applied. Idempotent — re-embeds only rows whose `embedding_source` no
 * longer matches the current corpus (or is null).
 *
 *   OPENAI_API_KEY=sk-... \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   bun run scripts/backfill-spot-embeddings.ts
 *
 * Safe to run multiple times. Stops on repeated failures (likely rate limit
 * or missing key) so a noisy OpenAI outage doesn't chew through the catalog.
 */

import { createClient } from "@supabase/supabase-js";
import { buildSpotCorpus, embedSpot } from "../src/lib/embeddings";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: spots, error } = await supabase
    .from("spots")
    .select(
      "id, name, category, subcategory, vibes, neighborhood, city, description, embedding_source",
    )
    .order("id");

  if (error) {
    console.error("Fetch failed:", error);
    process.exit(1);
  }
  if (!spots || spots.length === 0) {
    console.log("No spots to backfill.");
    return;
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  for (const spot of spots) {
    const nextCorpus = buildSpotCorpus(spot);
    if (!nextCorpus) {
      skipped++;
      continue;
    }
    if (nextCorpus === spot.embedding_source) {
      skipped++;
      continue;
    }

    try {
      const result = await embedSpot(spot);
      if (!result) {
        skipped++;
        continue;
      }
      const { error: updateErr } = await supabase
        .from("spots")
        .update({
          embedding: result.embedding,
          embedding_source: result.source,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", spot.id);
      if (updateErr) throw updateErr;
      done++;
      consecutiveFailures = 0;
      console.log(`  [${done}] ${spot.id} — ${spot.name}`);
    } catch (err) {
      failed++;
      consecutiveFailures++;
      console.error(`  [fail] ${spot.id}:`, err);
      if (consecutiveFailures >= 5) {
        console.error("Too many consecutive failures — aborting.");
        break;
      }
    }
  }

  console.log(`\nDone. embedded=${done} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
