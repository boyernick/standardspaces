import { requireAuth } from "@/lib/auth";
import { getUserFavorites } from "@/app/actions/saves";
import { getSpotsByIds } from "@/lib/data";
import Navbar from "@/components/Navbar";
import FavoritesClient from "./FavoritesClient";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  await requireAuth();
  const favoriteIds = await getUserFavorites();
  const spots = await getSpotsByIds(favoriteIds);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <FavoritesClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
