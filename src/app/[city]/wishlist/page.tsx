import { requireAuth } from "@/lib/auth";
import { getUserWishlist } from "@/app/actions/saves";
import { getSpotById } from "@/lib/data";
import { Spot } from "@/lib/types";
import Navbar from "@/components/Navbar";
import WishlistClient from "./WishlistClient";

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  await requireAuth();
  const wishlistIds = await getUserWishlist();

  const spots = (
    await Promise.all(wishlistIds.map((id) => getSpotById(id)))
  ).filter((s): s is Spot => s !== null);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <WishlistClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
