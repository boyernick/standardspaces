import { getSpotsByCity } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import MiamiClient from "./MiamiClient";

export default async function MiamiPage() {
  await requireAuth();
  const spots = await getSpotsByCity("Miami");
  return <MiamiClient spots={spots} />;
}
