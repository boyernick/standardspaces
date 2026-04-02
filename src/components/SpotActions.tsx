"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Heart, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type InteractionType = "bookmark" | "favorite" | "checkin";

const actions: { type: InteractionType; label: string; Icon: typeof Bookmark }[] = [
  { type: "bookmark", label: "Save", Icon: Bookmark },
  { type: "favorite", label: "Favorite", Icon: Heart },
  { type: "checkin", label: "Been here", Icon: CheckCircle },
];

export default function SpotActions({ spotId, hasBookingBar = false }: { spotId: string; hasBookingBar?: boolean }) {
  const [active, setActive] = useState<Set<InteractionType>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("user_interactions")
        .select("type")
        .eq("user_id", user.id)
        .eq("spot_id", spotId);

      if (data) {
        setActive(new Set(data.map((r) => r.type as InteractionType)));
      }
      setLoading(false);
    }
    init();
  }, [spotId]);

  const toggle = useCallback(
    async (type: InteractionType) => {
      if (!userId) return;

      const isActive = active.has(type);
      // Optimistic update
      setActive((prev) => {
        const next = new Set(prev);
        if (isActive) next.delete(type);
        else next.add(type);
        return next;
      });

      if (isActive) {
        await supabase
          .from("user_interactions")
          .delete()
          .eq("user_id", userId)
          .eq("spot_id", spotId)
          .eq("type", type);
      } else {
        await supabase
          .from("user_interactions")
          .insert({ user_id: userId, spot_id: spotId, type });
      }
    },
    [userId, active, spotId, supabase],
  );

  if (loading || !userId) return null;

  return (
    <div className={`fixed left-0 right-0 z-20 pointer-events-none ${hasBookingBar ? "bottom-16 md:bottom-0" : "bottom-0"}`}>
      <div className="max-w-3xl mx-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-auto">
        <div className="bg-surface/90 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg px-2 py-2 mb-3 flex items-center justify-evenly gap-1">
          {actions.map(({ type, label, Icon }) => {
            const isActive = active.has(type);
            return (
              <button
                key={type}
                onClick={() => toggle(type)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 0 : 1.5}
                  fill={isActive ? "var(--color-brand-900)" : "none"}
                  className={isActive ? "text-brand-900" : "text-neutral-400 dark:text-neutral-500"}
                />
                <span
                  className={`text-[11px] font-medium ${
                    isActive
                      ? "text-brand-900"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
