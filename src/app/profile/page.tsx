import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };
import { getSpotsByIds } from "@/lib/data";
import { getProfileStats } from "@/app/actions/profile";
import { getPastAttendedEvents } from "@/lib/events";
import Navbar from "@/components/Navbar";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const [{ data: profile }, stats, { data: favRows }, { data: wishRows }, { data: checkinRows }, attendedEvents] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      getProfileStats(user.id),
      supabase
        .from("user_favorites")
        .select("spot_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_wishlist")
        .select("spot_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_checkins")
        .select("spot_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      getPastAttendedEvents(user.id),
    ]);

  const favIds = (favRows ?? []).map((r) => r.spot_id);
  const wishIds = (wishRows ?? []).map((r) => r.spot_id);

  const checkinIds = (checkinRows ?? []).map((r) => r.spot_id);

  // Fetch all unique spots in one batch
  const allIds = [...new Set([...favIds, ...wishIds, ...checkinIds])];
  const allSpots = await getSpotsByIds(allIds);
  const spotMap = new Map(allSpots.map((s) => [s.id, s]));

  const favoriteSpots = favIds.map((id) => spotMap.get(id)).filter(Boolean);
  const wishlistSpots = wishIds.map((id) => spotMap.get(id)).filter(Boolean);
  const checkinSpots = checkinIds.map((id) => spotMap.get(id)).filter(Boolean);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <ProfileClient
        profile={profile}
        stats={stats}
        isOwn
        favoriteSpots={favoriteSpots as typeof allSpots}
        wishlistSpots={wishlistSpots as typeof allSpots}
        checkinSpots={checkinSpots as typeof allSpots}
        attendedEvents={attendedEvents}
      />
    </div>
  );
}
