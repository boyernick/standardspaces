"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import SaveButton from "./SaveButton";

/** Wrapper that loads save state client-side so the parent page can stay static. */
export default function SaveButtonClient({ spotId, size = "md" }: { spotId: string; size?: "sm" | "md" | "icon" }) {
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data } = await supabase
        .from("user_saves")
        .select("id")
        .eq("user_id", user.id)
        .eq("spot_id", spotId)
        .single();
      setSaved(!!data);
      setLoaded(true);
    })();
  }, [spotId]);

  if (!loaded) {
    return <SaveButton spotId={spotId} initialSaved={false} size={size} />;
  }

  return <SaveButton spotId={spotId} initialSaved={saved} size={size} />;
}
