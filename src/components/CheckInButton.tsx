"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkIn, uncheckIn } from "@/app/actions/saves";

export default function CheckInButton({ spotId, variant }: { spotId: string; variant?: "icon" }) {
  const [count, setCount] = useState(0);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count: c } = await supabase
        .from("user_checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("spot_id", spotId);
      setCount(c ?? 0);
    })();
  }, [spotId]);

  const isChecked = count > 0 || justCheckedIn;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isChecked && !justCheckedIn) {
      // Uncheck
      setCount(0);
      startTransition(async () => {
        await uncheckIn(spotId);
      });
    } else {
      // Check in
      setCount((c) => c + 1);
      setJustCheckedIn(true);
      setTimeout(() => setJustCheckedIn(false), 2000);
      startTransition(async () => {
        await checkIn(spotId);
      });
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={isChecked ? `Visited ${count} times` : "Mark as visited"}
        title={isChecked ? `Visited (${count})` : "Visited"}
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
