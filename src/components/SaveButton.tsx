"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleSave } from "@/app/actions/saves";

interface SaveButtonProps {
  spotId: string;
  initialSaved: boolean;
  size?: "sm" | "md" | "icon";
}

export default function SaveButton({ spotId, initialSaved, size = "sm" }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved(!saved);
    startTransition(async () => {
      const result = await toggleSave(spotId);
      setSaved(result.saved);
    });
  }

  if (size === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={saved ? "Unsave" : "Save"}
        title={saved ? "Saved" : "Save"}
      >
        <Heart size={16} strokeWidth={2} className={saved ? "fill-red-500 text-red-500" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  if (size === "sm") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={saved ? "Unsave" : "Save"}
      >
        <Heart size={15} strokeWidth={2} className={saved ? "fill-red-500 text-red-500" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
      aria-label={saved ? "Unsave" : "Save"}
    >
      <Heart size={14} strokeWidth={2} className={saved ? "fill-red-500 text-red-500" : ""} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
