"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleCheck, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkIn, uncheckIn, moveWishlistToFavorite } from "@/app/actions/saves";

export default function CheckInButton({ spotId, variant }: { spotId: string; variant?: "icon" }) {
  const [count, setCount] = useState(0);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ count: c }, { data: wishlistData }] = await Promise.all([
        supabase.from("user_checkins").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("spot_id", spotId),
        supabase.from("user_wishlist").select("id").eq("user_id", user.id).eq("spot_id", spotId).single(),
      ]);
      setCount(c ?? 0);
      setIsWishlisted(!!wishlistData);
    })();
  }, [spotId]);

  const isChecked = count > 0 || justCheckedIn;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isChecked && !justCheckedIn) {
      setCount(0);
      startTransition(async () => { await uncheckIn(spotId); });
    } else {
      setCount((c) => c + 1);
      setJustCheckedIn(true);
      startTransition(async () => { await checkIn(spotId); });
      // Show wishlist→favorite prompt if wishlisted
      if (isWishlisted) {
        setTimeout(() => setShowPrompt(true), 500);
      } else {
        setTimeout(() => setJustCheckedIn(false), 2000);
      }
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
          aria-label={isChecked ? `Visited ${count} times` : "Mark as visited"}
          data-tooltip={isChecked ? `Visited (${count})` : "Check in"}
        >
          {isChecked ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="currentColor" className="text-neutral-900 dark:text-white" />
              <path d="m9 12 2 2 4-4" stroke="var(--color-surface)" strokeWidth="2" />
            </svg>
          ) : (
            <CircleCheck size={18} strokeWidth={1.5} className="text-neutral-600 dark:text-neutral-300" />
          )}
        </button>

        {/* Wishlist → Favorite prompt */}
        {showPrompt && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-3 z-50 animate-[fadeSlideDown_150ms_ease-out]">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">You visited this spot! Add to favorites?</p>
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
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
    >
      <CircleCheck size={14} strokeWidth={2} className={isChecked ? "text-green-600" : ""} />
      {justCheckedIn ? "Marked visited!" : isChecked ? `Visited (${count})` : "Visited"}
    </button>
  );
}
