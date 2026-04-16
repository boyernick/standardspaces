"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import RatingSheet from "@/components/RatingSheet";
import type { Bucket } from "@/lib/ratings";

/**
 * Shown on the space detail page under the action bar. Renders the current
 * user's rating for this space (with a "Re-rate" affordance) and, if the
 * space has at least `AGGREGATE_MIN_COUNT` ratings, the member average.
 *
 * The aggregate is fetched server-side for SSR and passed in as a prop. The
 * user's own rating is fetched client-side so cached marketing HTML doesn't
 * leak per-user state.
 */
export default function SpotRatingInline({
  spotId,
  spotName,
  initialAggregate,
}: {
  spotId: string;
  spotName: string;
  initialAggregate: { avg: number; count: number } | null;
}) {
  const [myScore, setMyScore] = useState<number | null>(null);
  const [myBucket, setMyBucket] = useState<Bucket | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("spot_ratings")
        .select("score, bucket")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .single();
      if (data) {
        setMyScore(Number(data.score));
        setMyBucket(data.bucket as Bucket);
      }
      setLoaded(true);
    })();
  }, [spotId]);

  function handleClose() {
    setOpen(false);
    // Re-read the rating after the sheet closes so the inline label reflects
    // whatever the user just submitted.
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("spot_ratings")
        .select("score, bucket")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .single();
      if (data) {
        setMyScore(Number(data.score));
        setMyBucket(data.bucket as Bucket);
      }
    })();
  }

  if (!loaded && !initialAggregate) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {myScore !== null && (
        <button
          onClick={() => setOpen(true)}
          className="text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          You rated this{" "}
          <span className="font-semibold tabular-nums">
            {myScore.toFixed(1)}
          </span>
          <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500 underline underline-offset-2">
            Re-rate
          </span>
        </button>
      )}
      {initialAggregate && (
        <span className="text-neutral-500 dark:text-neutral-400">
          Members rate this{" "}
          <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
            {initialAggregate.avg.toFixed(1)}
          </span>{" "}
          <span className="text-neutral-400 dark:text-neutral-500">
            · {initialAggregate.count} ratings
          </span>
        </span>
      )}

      <RatingSheet
        spotId={spotId}
        spotName={spotName}
        initialBucket={myBucket}
        open={open}
        onClose={handleClose}
      />
    </div>
  );
}
