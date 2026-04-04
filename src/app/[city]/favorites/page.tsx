import { requireAuth } from "@/lib/auth";
import { getSpotsByIds } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import FavoritesClient from "./FavoritesClient";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  const user = await requireAuth();

  // Single query: get favorite IDs directly (no extra getUser call)
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_favorites")
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favoriteIds = (data ?? []).map((r) => r.spot_id);
  const spots = await getSpotsByIds(favoriteIds);

  return (
    <div className="h-screen flex flex-col bg-surface animate-[pageIn_200ms_ease-out]">
      <Navbar />
      <FavoritesClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
