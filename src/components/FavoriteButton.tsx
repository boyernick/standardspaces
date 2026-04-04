"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/actions/saves";

interface FavoriteButtonProps {
  spotId: string;
  initialFavorited: boolean;
  size?: "sm" | "md" | "icon";
}

export default function FavoriteButton({ spotId, initialFavorited, size = "sm" }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorited(!favorited);
    startTransition(async () => {
      const result = await toggleFavorite(spotId);
      setFavorited(result.favorited);
    });
  }

  if (size === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        data-tooltip={favorited ? "Favorited" : "Favorite"}
      >
        <Heart size={16} strokeWidth={2} className={favorited ? "fill-red-500 text-red-500" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  if (size === "sm") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart size={15} strokeWidth={2} className={favorited ? "fill-red-500 text-red-500" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart size={14} strokeWidth={2} className={favorited ? "fill-red-500 text-red-500" : ""} />
      {favorited ? "Favorited" : "Favorite"}
    </button>
  );
}
