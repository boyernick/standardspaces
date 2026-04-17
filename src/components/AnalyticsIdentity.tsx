"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAnalyticsIdentity } from "@/lib/analytics";

/**
 * Publishes the signed-in user's id into the analytics module ref so that
 * client-side `track()` calls auto-attach `user_id` to every custom event.
 *
 * Mounted once in the root layout. Renders nothing. Listens for auth state
 * changes (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`) so sign-in mid-
 * session starts stamping events without a full reload, and sign-out
 * clears the ref so subsequent anonymous events don't carry a stale id.
 *
 * Keeping this separate from the `<Analytics />` component means the
 * Vercel script stays free to tree-shake; this just reads auth state
 * once on mount and subscribes.
 */
export default function AnalyticsIdentity() {
  useEffect(() => {
    const supabase = createClient();

    // Seed immediately with the current session (if any). `getUser()` is
    // authoritative and works for both cookie-based and bearer sessions.
    supabase.auth.getUser().then(({ data }) => {
      setAnalyticsIdentity(data.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAnalyticsIdentity(session?.user?.id ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
