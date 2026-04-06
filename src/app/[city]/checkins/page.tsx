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
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const spotIds = (data ?? []).map((r) => r.spot_id);
  const spots = await getSpotsByIds(spotIds);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <PageEnter>
        <CheckinsClient spots={spots} citySlug={citySlug} />
      </PageEnter>
    </div>
  );
}
