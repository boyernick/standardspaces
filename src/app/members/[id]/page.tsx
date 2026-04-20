import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpotsByIds } from "@/lib/data";
import { getProfileStats } from "@/app/actions/profile";
import { getFollowStatus } from "@/app/actions/follows";
import { getPastAttendedEvents } from "@/lib/events";
import PageShell from "@/components/ui/PageShell";
import ProfileClient from "@/app/profile/ProfileClient";

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  if (id === user.id) {
    redirect("/profile");
  }

  const supabase = await createClient();

  const [{ data: profile }, stats, isFollowing, { data: favRows }, { data: checkinRows }, { data: ratingRows }, attendedEvents] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    getProfileStats(id),
    getFollowStatus(id),
    supabase
      .from("user_favorites")
      .select("spot_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_checkins")
      .select("spot_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("spot_ratings")
      .select("spot_id, score")
      .eq("user_id", id),
    getPastAttendedEvents(id),
  ]);

  if (!profile) {
    notFound();
  }

  const favIds = (favRows ?? []).map((r) => r.spot_id);

  const checkinIds = (checkinRows ?? []).map((r) => r.spot_id);

  const allIds = [...new Set([...favIds, ...checkinIds])];
  const allSpots = await getSpotsByIds(allIds);
  const spotMap = new Map(allSpots.map((s) => [s.id, s]));

  const favoriteSpots = favIds.map((id) => spotMap.get(id)).filter(Boolean);
  const checkinSpots = checkinIds.map((id) => spotMap.get(id)).filter(Boolean);

  const ratings: Record<string, number> = {};
  for (const r of ratingRows ?? []) {
    ratings[r.spot_id as string] = Number(r.score);
  }

  return (
    <PageShell maxWidth="md">
      <ProfileClient
        profile={profile}
        stats={stats}
        isOwn={false}
        isFollowing={isFollowing}
        favoriteSpots={favoriteSpots as typeof allSpots}
        checkinSpots={checkinSpots as typeof allSpots}
        attendedEvents={attendedEvents}
        ratings={ratings}
      />
    </PageShell>
  );
}
