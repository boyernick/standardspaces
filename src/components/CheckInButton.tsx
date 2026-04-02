"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkIn } from "@/app/actions/saves";

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

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCount((c) => c + 1);
    setJustCheckedIn(true);
    setTimeout(() => setJustCheckedIn(false), 2000);
    startTransition(async () => {
      await checkIn(spotId);
    });
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={count > 0 ? `Visited ${count} times` : "Mark as visited"}
        title={count > 0 ? `Visited (${count})` : "Visited"}
      >
        <CircleCheck size={16} strokeWidth={2} className={justCheckedIn || count > 0 ? "text-green-600" : "text-neutral-600 dark:text-neutral-300"} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600"
    >
      <CircleCheck size={14} strokeWidth={2} className={justCheckedIn ? "text-green-600" : ""} />
      {justCheckedIn ? "Marked visited!" : count > 0 ? `Visited (${count})` : "Visited"}
    </button>
  );
}
