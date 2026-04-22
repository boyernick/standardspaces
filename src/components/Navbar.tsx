import { createClient } from "@/lib/supabase/server";
import { getPendingReferralCount } from "@/app/actions/referrals";
import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { getAdminPendingCount } from "@/app/actions/admin";
import NavbarClient from "./NavbarClient";

/**
 * Server wrapper that prefetches the data NavbarClient used to fetch from
 * the browser. Pages render this (not NavbarClient directly) so the avatar,
 * name, and badge counts are embedded in the initial HTML — no placeholder
 * flash, no post-hydration network round trip.
 *
 * On failure (unauth, db error) we silently fall through to the client
 * component's existing localStorage + lazy-fetch path so nothing breaks.
 */
export default async function Navbar() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Signed out — render with explicit null so the client stops waiting
      // for a resolution and shows the initials/empty fallback immediately.
      return (
        <NavbarClient
          initialAvatarUrl={null}
          initialDisplayName={null}
          initialIsAdmin={false}
          initialUnreadNotifs={0}
          initialPendingReferrals={0}
          initialAdminPending={0}
        />
      );
    }

    // Fire the profile read and the three count actions in parallel —
    // none depend on each other once we have the user id.
    const [profileRes, pendingReferrals, unreadNotifs, adminPending] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("role, avatar_url, first_name, last_name")
          .eq("id", user.id)
          .single(),
        getPendingReferralCount(),
        getUnreadNotificationCount(),
        getAdminPendingCount(),
      ]);

    const profile = profileRes.data;
    const displayName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      null;

    return (
      <NavbarClient
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialDisplayName={displayName}
        initialIsAdmin={profile?.role === "admin"}
        initialUnreadNotifs={unreadNotifs}
        initialPendingReferrals={pendingReferrals}
        initialAdminPending={adminPending}
      />
    );
  } catch {
    return <NavbarClient />;
  }
}
