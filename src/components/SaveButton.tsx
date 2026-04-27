"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleWishlist } from "@/app/actions/saves";
import Toast from "@/components/ui/Toast";

/**
 * Secondary-pill "Save" toggle for the space detail toolbar. Replaces the
 * separate Wishlist + Favorite icons — "save" maps to wishlist ("I want
 * to go"); favoriting is an explicit affordance inside the RatingSheet
 * after a check-in ("loved it"). Keeps the toolbar to two decisions:
 * primary = Check in, secondary = Save.
 *
 * Fires a bottom-centered toast on save so the feedback is obvious
 * without an icon state change (text-only buttons per project rules).
 */
export default function SaveButton({
  spotId,
  initialWishlisted,
}: {
  spotId: string;
  initialWishlisted?: boolean;
}) {
  const hasInitial = initialWishlisted !== undefined;
  const [saved, setSaved] = useState(initialWishlisted ?? false);
  const [loaded, setLoaded] = useState(hasInitial);
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hydrate initial state from the user's wishlist so the label matches
  // reality on return visits. Skipped when the parent already passed
  // initialWishlisted (e.g. from SpotActionBar's batched query).
  useEffect(() => {
    if (hasInitial) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("user_wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .maybeSingle();
      setSaved(!!data);
      setLoaded(true);
    })();
  }, [spotId, hasInitial]);

  function handleClick() {
    // Optimistic flip + toast so the tap feels instant. We re-sync from
    // the server response in case the row was ahead of local state.
    const next = !saved;
    setSaved(next);
    setToastMessage(next ? "Saved to wishlist" : "Removed from wishlist");
    startTransition(async () => {
      const result = await toggleWishlist(spotId);
      setSaved(result.wishlisted);
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending || !loaded}
        aria-pressed={saved}
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-[border-color] duration-[var(--duration-fast)] active:scale-[0.98] disabled:opacity-60"
      >
        {saved ? "Saved" : "Save"}
      </button>
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
