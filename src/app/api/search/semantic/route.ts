import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/embeddings";

/**
 * Semantic search over spots. Runs alongside the substring filter in the
 * command menu; only fires when the substring path returns thin results.
 *
 * Contract:
 *   GET /api/search/semantic?q=some+intent+query
 *   → 200 { results: Array<{ id: string, similarity: number }> }
 *   → 400 if q is missing / too short
 *   → 401 if unauthenticated (the command menu is member-only)
 *   → 503 if embeddings are not configured
 */
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

  if (!process.env.OPENAI_API_KEY) {
    // Soft-fail: the client treats any non-200 as "no related results" and
    // the substring path still works. This is the right response when the
    // feature simply isn't wired up in a given environment.
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let vector: number[] | null = null;
  try {
    vector = await embedQuery(q);
  } catch (err) {
    console.error("embedQuery failed:", err);
    return NextResponse.json({ error: "embedding failed" }, { status: 502 });
  }
  if (!vector) {
    return NextResponse.json({ results: [] });
  }

  // Use the admin client for the RPC so the vector comparison bypasses RLS
  // on the embedding column — the user is already authenticated and we only
  // return ids, which they can already read via the normal spots policy.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_spots", {
    query_embedding: vector as unknown as string,
    match_count: 8,
    min_similarity: 0.3,
  });

  if (error) {
    console.error("match_spots RPC failed:", error);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
