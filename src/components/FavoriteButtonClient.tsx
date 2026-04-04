"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import FavoriteButton from "./FavoriteButton";

/** Wrapper that loads favorite state client-side so the parent page can stay static. */
export default function FavoriteButtonClient({ spotId, size = "md" }: { spotId: string; size?: "sm" | "md" | "icon" }) {
  const [favorited, setFavorited] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data } = await supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .single();
      setFavorited(!!data);
      setLoaded(true);
    })();
  }, [spotId]);

  if (!loaded) return <FavoriteButton spotId={spotId} initialFavorited={false} size={size} />;
  return <FavoriteButton spotId={spotId} initialFavorited={favorited} size={size} />;
}
