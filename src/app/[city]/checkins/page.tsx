import { requireAuth } from "@/lib/auth";
import { getSpotsByIds } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import PageEnter from "@/components/PageEnter";
import CheckinsClient from "./CheckinsClient";

export default async function CheckinsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  const user = await requireAuth();

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_checkins")
    .select("spot_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Get distinct spot IDs preserving most-recent-first order
  const seen = new Set<string>();
  const spotIds: string[] = [];
  for (const r of data ?? []) {
    if (!seen.has(r.spot_id)) {
      seen.add(r.spot_id);
      spotIds.push(r.spot_id);
    }
  }

  // Count check-ins per spot
  const checkinCounts = new Map<string, number>();
  for (const r of data ?? []) {
    checkinCounts.set(r.spot_id, (checkinCounts.get(r.spot_id) ?? 0) + 1);
  }

  const spots = await getSpotsByIds(spotIds);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <PageEnter>
        <CheckinsClient spots={spots} citySlug={citySlug} checkinCounts={Object.fromEntries(checkinCounts)} />
      </PageEnter>
    </div>
  );
}
