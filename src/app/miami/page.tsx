import { getSpotsByCity } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { getUserSaves } from "@/app/actions/saves";
import MiamiClient from "./MiamiClient";

export default async function MiamiPage() {
  await requireAuth();
  const [spots, savedSpotIds] = await Promise.all([
    getSpotsByCity("Miami"),
    getUserSaves(),
  ]);
  return <MiamiClient spots={spots} savedSpotIds={savedSpotIds} />;
}
