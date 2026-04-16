/**
 * Pure helpers for the Beli-style rating flow.
 *
 * A rating is a bucket + rank. The UI walks a binary search over the user's
 * existing ratings in the chosen bucket, narrowing `[lo, hi]` until a single
 * slot remains, then submits that slot as the new rank. The server persists
 * the rank and recomputes `score` for every rating in the bucket using
 * `scoreForRank`, so scores stay evenly spread across the bucket range as new
 * items are inserted.
 */

export type Bucket = "loved" | "liked" | "okay" | "disliked" | "hated";

/** Ordered best → worst. The RatingSheet renders buttons in this order. */
export const BUCKETS: Bucket[] = [
  "loved",
  "liked",
  "okay",
  "disliked",
  "hated",
];

/** Lower (inclusive) / upper (inclusive) score bounds per bucket. */
export const BUCKET_RANGES: Record<Bucket, { min: number; max: number }> = {
  loved: { min: 4.2, max: 5.0 },
  liked: { min: 3.4, max: 4.2 },
  okay: { min: 2.6, max: 3.4 },
  disliked: { min: 1.8, max: 2.6 },
  hated: { min: 1.0, max: 1.8 },
};

export const BUCKET_LABELS: Record<Bucket, string> = {
  loved: "Loved it",
  liked: "Liked it",
  okay: "It was okay",
  disliked: "Not for me",
  hated: "Never again",
};

/**
 * Map a 1-indexed rank within a bucket of `total` items to a numeric score.
 * Rank 1 is the best in the bucket. The formula evenly stripes the bucket's
 * range so the best item sits near `max` and the worst near `min`, with a
 * half-step inset on each end so the same item doesn't collapse to the bound
 * regardless of how crowded the bucket gets.
 *
 * Rounded to one decimal to match the numeric(3,1) column and the UI's
 * "Members rate this 4.3" display.
 */
export function scoreForRank(
  bucket: Bucket,
  rank: number,
  total: number,
): number {
  const { min, max } = BUCKET_RANGES[bucket];
  if (total <= 1) {
    const mid = (min + max) / 2;
    return round1(mid);
  }
  const t = (rank - 0.5) / total;
  const score = max - (max - min) * t;
  const clamped = Math.max(min, Math.min(max, score));
  return round1(clamped);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pick the midpoint of a `[lo, hi]` inclusive range for the next pairwise
 * comparison. Matches the binary search that drives the UI.
 */
export function pickComparisonIndex(lo: number, hi: number): number {
  return Math.floor((lo + hi) / 2);
}
