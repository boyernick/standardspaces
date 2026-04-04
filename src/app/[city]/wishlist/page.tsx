import { requireAuth } from "@/lib/auth";
import { getUserWishlist } from "@/app/actions/saves";
import { getSpotsByIds } from "@/lib/data";
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
  const spots = await getSpotsByIds(wishlistIds);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <WishlistClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
