"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SaveButton from "./SaveButton";
import CheckInButton from "./CheckInButton";

/**
 * Owns the "has this user visited / saved this space" read for the
 * bottom action bar so both child buttons share one Supabase round-trip.
 * Once checked-in, Save disappears (visiting supersedes the "want to go"
 * signal) and Check in flips to secondary styling to de-emphasize a
 * redundant primary tap. Non-visited state keeps Check in as the filled
 * primary + Save alongside as secondary.
 */
export default function SpotActionBar({
  spotId,
  spotName,
}: {
  spotId: string;
  spotName: string;
}) {
  const [isChecked, setIsChecked] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoaded(true);
        return;
      }
      const [{ data: checkin }, { data: wishlist }] = await Promise.all([
        supabase.from("user_checkins").select("id").eq("user_id", user.id).eq("spot_id", spotId).maybeSingle(),
        supabase.from("user_wishlist").select("id").eq("user_id", user.id).eq("spot_id", spotId).maybeSingle(),
      ]);
      setIsChecked(!!checkin);
      setIsWishlisted(!!wishlist);
      setLoaded(true);
    })();
  }, [spotId]);

  return (
    <div className="ml-auto flex items-center gap-2">
      {loaded && !isChecked && (
        <SaveButton spotId={spotId} initialWishlisted={isWishlisted} />
      )}
      <CheckInButton
        key={`checkin-${loaded}-${isChecked ? "1" : "0"}`}
        spotId={spotId}
        spotName={spotName}
        variant="pill"
        initialChecked={isChecked}
      />
    </div>
  );
}
