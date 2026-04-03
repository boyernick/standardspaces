import { requireAuth } from "@/lib/auth";
import { getUserSaves } from "@/app/actions/saves";
import { getSpotById } from "@/lib/data";
import { Spot } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SavedClient from "./SavedClient";

export default async function SavedPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  await requireAuth();
  const savedIds = await getUserSaves();

  const spots = (
    await Promise.all(savedIds.map((id) => getSpotById(id)))
  ).filter((s): s is Spot => s !== null);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <SavedClient spots={spots} citySlug={citySlug} />
    </div>
  );
}
