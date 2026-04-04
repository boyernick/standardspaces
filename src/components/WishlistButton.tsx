"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toggleWishlist } from "@/app/actions/saves";

interface WishlistButtonProps {
  spotId: string;
  initialWishlisted: boolean;
  size?: "sm" | "md" | "icon";
}

export default function WishlistButton({ spotId, initialWishlisted, size = "sm" }: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setWishlisted(!wishlisted);
    startTransition(async () => {
      const result = await toggleWishlist(spotId);
      setWishlisted(result.wishlisted);
    });
  }

  if (size === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        data-tooltip={wishlisted ? "On wishlist" : "Wishlist"}
      >
        <Bookmark size={16} strokeWidth={2} className={wishlisted ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  if (size === "sm") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Bookmark size={15} strokeWidth={2} className={wishlisted ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Bookmark size={14} strokeWidth={2} className={wishlisted ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" : ""} />
      {wishlisted ? "On wishlist" : "Wishlist"}
    </button>
  );
}
