"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSpotsByIds } from "@/lib/data";
import type { Spot } from "@/lib/types";
import { scoreForRank, type Bucket } from "@/lib/ratings";

const ALL_BUCKETS: Bucket[] = ["loved", "liked", "okay", "disliked", "hated"];

export type UserRating = {
  spot_id: string;
  bucket: Bucket;
  score: number;
  bucket_rank: number;
};

/**
 * Return the current user's rating for a given spot, if any.
 */
export async function getUserRating(
  spotId: string,
): Promise<UserRating | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("spot_ratings")
    .select("spot_id, bucket, score, bucket_rank")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .single();

  if (!data) return null;
  return {
    spot_id: data.spot_id as string,
    bucket: data.bucket as Bucket,
    score: Number(data.score),
    bucket_rank: data.bucket_rank as number,
  };
}

/**
 * Return a map of spotId → rating for every spot in `spotIds` the current
 * user has rated. Used by list views (check-ins page, profile) to render
 * score chips.
 */
export async function getUserRatingsMap(
  spotIds: string[],
): Promise<Record<string, UserRating>> {
  if (spotIds.length === 0) return {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("spot_ratings")
    .select("spot_id, bucket, score, bucket_rank")
    .eq("user_id", user.id)
    .in("spot_id", spotIds);

  const out: Record<string, UserRating> = {};
  for (const r of data ?? []) {
    out[r.spot_id as string] = {
      spot_id: r.spot_id as string,
      bucket: r.bucket as Bucket,
      score: Number(r.score),
      bucket_rank: r.bucket_rank as number,
    };
  }
  return out;
}

/**
 * The current user's prior ratings in `bucket`, ordered best → worst, joined
 * with hydrated spot rows. Used to drive the pairwise comparison flow.
 *
 * Excludes `excludeSpotId` (the space being rated/re-rated) so the compare
 * pool never includes the candidate itself.
 */
export async function getBucketPool(
  bucket: Bucket,
  excludeSpotId?: string,
): Promise<{ rating: UserRating; spot: Spot }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("spot_ratings")
    .select("spot_id, bucket, score, bucket_rank")
    .eq("user_id", user.id)
    .eq("bucket", bucket)
    .order("bucket_rank", { ascending: true });

  const rows = (data ?? []).filter(
    (r) => r.spot_id !== excludeSpotId,
  ) as UserRating[];

  const spots = await getSpotsByIds(rows.map((r) => r.spot_id));
  const spotMap = new Map(spots.map((s) => [s.id, s]));

  return rows
    .map((r) => {
      const spot = spotMap.get(r.spot_id);
      if (!spot) return null;
      return {
        rating: {
          spot_id: r.spot_id,
          bucket: r.bucket as Bucket,
          score: Number(r.score),
          bucket_rank: r.bucket_rank as number,
        },
        spot,
      };
    })
    .filter((x): x is { rating: UserRating; spot: Spot } => x !== null);
}

/**
 * Persist a rating for the current user at `spotId` with bucket + rank.
 *
 * `rank` is 1-indexed within the target bucket and must lie in
 * `[1, poolSize + 1]` where poolSize is the number of existing ratings in
 * that bucket (excluding the target spot). After upserting we recompute
 * scores for every rating in the affected bucket(s) — the target bucket and,
 * if the spot moved, the previous bucket.
 */
export async function submitRating(
  spotId: string,
  bucket: Bucket,
  rank: number,
): Promise<{ success: boolean; score?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "unauthenticated" };

  if (!ALL_BUCKETS.includes(bucket)) {
    return { success: false, error: "invalid bucket" };
  }

  // Figure out whether the spot was previously rated and if so, in which
  // bucket. If it's moving buckets we'll recompute scores for the old
  // bucket too.
  const { data: existing } = await supabase
    .from("spot_ratings")
    .select("bucket")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .single();
  const previousBucket = (existing?.bucket as Bucket | undefined) ?? null;

  // Fetch the existing rows in the target bucket, excluding this spot. The
  // ordering gives us the reference list in which `rank` is to be inserted.
  const { data: poolRows } = await supabase
    .from("spot_ratings")
    .select("id, spot_id, bucket_rank")
    .eq("user_id", user.id)
    .eq("bucket", bucket)
    .order("bucket_rank", { ascending: true });

  const pool = (poolRows ?? []).filter((r) => r.spot_id !== spotId) as Array<{
    id: string;
    spot_id: string;
    bucket_rank: number;
  }>;

  const maxRank = pool.length + 1;
  const clampedRank = Math.max(1, Math.min(maxRank, Math.floor(rank)));

  // Build the new ordering for the target bucket. `clampedRank` is 1-indexed:
  // insert before the element currently at that position.
  const newOrder: string[] = [
    ...pool.slice(0, clampedRank - 1).map((r) => r.spot_id),
    spotId,
    ...pool.slice(clampedRank - 1).map((r) => r.spot_id),
  ];
  const totalInBucket = newOrder.length;

  // Upsert the target spot first so we have an id to update and the unique
  // (user_id, spot_id) constraint owns the row.
  const targetScore = scoreForRank(bucket, clampedRank, totalInBucket);
  const { error: upsertErr } = await supabase.from("spot_ratings").upsert(
    {
      user_id: user.id,
      spot_id: spotId,
      bucket,
      bucket_rank: clampedRank,
      score: targetScore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,spot_id" },
  );
  if (upsertErr) {
    console.error("submitRating upsert error:", upsertErr.message);
    return { success: false, error: upsertErr.message };
  }

  // Recompute every rating's rank+score in the target bucket, one update per
  // spot. We can't batch-upsert without the row ids, and doing per-spot
  // updates is fine given the bucket size is bounded by a user's personal
  // list.
  await Promise.all(
    newOrder.map((sid, idx) => {
      const rnk = idx + 1;
      if (sid === spotId) return Promise.resolve();
      const score = scoreForRank(bucket, rnk, totalInBucket);
      return supabase
        .from("spot_ratings")
        .update({
          bucket_rank: rnk,
          score,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("spot_id", sid);
    }),
  );

  // If we moved out of a different bucket, re-rank that bucket too.
  if (previousBucket && previousBucket !== bucket) {
    const { data: prevRows } = await supabase
      .from("spot_ratings")
      .select("spot_id")
      .eq("user_id", user.id)
      .eq("bucket", previousBucket)
      .order("bucket_rank", { ascending: true });
    const prevOrder = (prevRows ?? [])
      .map((r) => r.spot_id as string)
      .filter((s) => s !== spotId);
    const prevTotal = prevOrder.length;
    await Promise.all(
      prevOrder.map((sid, idx) => {
        const rnk = idx + 1;
        const score = scoreForRank(previousBucket, rnk, prevTotal);
        return supabase
          .from("spot_ratings")
          .update({
            bucket_rank: rnk,
            score,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("spot_id", sid);
      }),
    );
  }

  // Best-effort: patch the most recent follower_checkin notifications for
  // this actor+spot so the score renders in the follower feed. We use the
  // admin client because notifications have no insert/update RLS for users.
  try {
    const admin = createAdminClient();
    await admin
      .from("notifications")
      .update({ metadata: { score: targetScore } })
      .eq("type", "follower_checkin")
      .eq("actor_id", user.id)
      .eq("spot_id", spotId);
  } catch (err) {
    console.error("submitRating notification patch:", err);
  }

  return { success: true, score: targetScore };
}

/**
 * Aggregate score + rating count for a spot. Returns null when the count is
 * below the visibility threshold so callers can render nothing.
 */
const AGGREGATE_MIN_COUNT = 5;

export async function getSpotAggregate(
  spotId: string,
): Promise<{ avg: number; count: number } | null> {
  // Read via admin — the aggregate view is security_invoker, but we want
  // this to work on unauthenticated SSR renders too. The view only exposes
  // a count and rounded average, not any individual rating rows.
  const admin = createAdminClient();
  const { data } = await admin
    .from("spot_rating_aggregates")
    .select("avg_score, rating_count")
    .eq("spot_id", spotId)
    .single();
  if (!data) return null;
  const count = Number(data.rating_count);
  if (count < AGGREGATE_MIN_COUNT) return null;
  return { avg: Number(data.avg_score), count };
}
