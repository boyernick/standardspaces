import { requireAuth } from "@/lib/auth";
import { getSpotsByIds } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import WishlistClient from "./WishlistClient";

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  const user = await requireAuth();

  // Single query: get wishlist IDs directly (no extra getUser call)
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_wishlist")
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const wishlistIds = (data ?? []).map((r) => r.spot_id);
  const spots = await getSpotsByIds(wishlistIds);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <WishlistClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
