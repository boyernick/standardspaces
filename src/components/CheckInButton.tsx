"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleCheck, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkIn, uncheckIn, moveWishlistToFavorite } from "@/app/actions/saves";
import RatingSheet from "@/components/RatingSheet";

export default function CheckInButton({
  spotId,
  spotName,
  variant,
  initialChecked,
  initialWishlisted,
}: {
  spotId: string;
  spotName?: string;
  variant?: "icon";
  initialChecked?: boolean;
  initialWishlisted?: boolean;
}) {
  const hasInitial = initialChecked !== undefined || initialWishlisted !== undefined;
  const [isChecked, setIsChecked] = useState(initialChecked ?? false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted ?? false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState(spotName ?? "");

  useEffect(() => {
    if (hasInitial) {
      setIsChecked(initialChecked ?? false);
      setIsWishlisted(initialWishlisted ?? false);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: checkinData }, { data: wishlistData }] = await Promise.all([
        supabase.from("user_checkins").select("id").eq("user_id", user.id).eq("spot_id", spotId).single(),
        supabase.from("user_wishlist").select("id").eq("user_id", user.id).eq("spot_id", spotId).single(),
      ]);
      setIsChecked(!!checkinData);
      setIsWishlisted(!!wishlistData);
    })();
  }, [spotId, hasInitial, initialChecked, initialWishlisted]);

  // Best-effort fill of spot name for the rating sheet header when the
  // parent didn't pass it (e.g. older callers). Runs only when needed.
  useEffect(() => {
    if (resolvedName || !rateOpen) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("spots")
        .select("name")
        .eq("id", spotId)
        .single();
      if (data?.name) setResolvedName(data.name as string);
    })();
  }, [rateOpen, resolvedName, spotId]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isChecked && !justCheckedIn) {
      setIsChecked(false);
      startTransition(async () => { await uncheckIn(spotId); });
    } else {
      setIsChecked(true);
      setJustCheckedIn(true);
      startTransition(async () => { await checkIn(spotId); });
      // Open the rating sheet immediately after the optimistic check-in.
      setRateOpen(true);
    }
  }

  function handleRateClose() {
    setRateOpen(false);
    // After the rating sheet closes, offer the wishlist → favorite prompt
    // when applicable. This keeps the sheet single-purpose and preserves the
    // existing post-check-in hint without showing both at once.
    if (isWishlisted) {
      setShowPrompt(true);
    } else {
      setJustCheckedIn(false);
    }
  }

  function handleMoveToFavorites() {
    setShowPrompt(false);
    setJustCheckedIn(false);
    setIsWishlisted(false);
    startTransition(async () => { await moveWishlistToFavorite(spotId); });
  }

  function handleDismissPrompt() {
    setShowPrompt(false);
    setJustCheckedIn(false);
  }

  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={isPending}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label={isChecked ? "Visited" : "Mark as visited"}
          data-tooltip={isChecked ? "Visited" : "Check in"}
        >
          <span className="relative inline-block w-4 h-4">
            <CircleCheck
              size={16}
              strokeWidth={2}
              className="absolute inset-0 text-neutral-600 dark:text-neutral-300 transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]"
              style={{
                opacity: isChecked ? 0 : 1,
                transform: isChecked ? "scale(0.7)" : "scale(1)",
                filter: isChecked ? "blur(2px)" : "blur(0)",
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="absolute inset-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]"
              style={{
                opacity: isChecked ? 1 : 0,
                transform: isChecked ? "scale(1)" : "scale(0.7)",
                filter: isChecked ? "blur(0)" : "blur(2px)",
              }}
            >
              <circle cx="12" cy="12" r="10" fill="currentColor" className="text-neutral-900 dark:text-white" />
              <path d="m9 12 2 2 4-4" stroke="var(--color-surface)" strokeWidth="2" />
            </svg>
          </span>
        </button>

        {/* Wishlist → Favorite prompt */}
        {showPrompt && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-3 z-50 animate-[fadeSlideDown_150ms_ease-out]">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">You visited this space! Add to favorites?</p>
            <div className="flex gap-2">
              <button
                onClick={handleMoveToFavorites}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                <Heart size={12} /> Favorite
              </button>
              <button
                onClick={handleDismissPrompt}
                className="flex-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        <RatingSheet
          spotId={spotId}
          spotName={resolvedName || "this space"}
          open={rateOpen}
          onClose={handleRateClose}
        />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      >
        <CircleCheck size={14} strokeWidth={2} className={isChecked ? "text-green-600" : ""} />
        {justCheckedIn ? "Marked visited!" : isChecked ? "Visited" : "Visited"}
      </button>
      <RatingSheet
        spotId={spotId}
        spotName={resolvedName || "this space"}
        open={rateOpen}
        onClose={handleRateClose}
      />
    </>
  );
}
