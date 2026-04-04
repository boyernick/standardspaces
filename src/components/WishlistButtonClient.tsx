"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import WishlistButton from "./WishlistButton";

/** Wrapper that loads wishlist state client-side so the parent page can stay static. */
export default function WishlistButtonClient({ spotId, size = "md" }: { spotId: string; size?: "sm" | "md" | "icon" }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data, error } = await supabase
        .from("user_wishlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .maybeSingle();
      setWishlisted(!!data && !error);
      setLoaded(true);
    })();
  }, [spotId]);

  if (!loaded) return <WishlistButton spotId={spotId} initialWishlisted={false} size={size} />;
  return <WishlistButton spotId={spotId} initialWishlisted={wishlisted} size={size} />;
}
