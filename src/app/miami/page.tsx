import { getSpotsByCity } from "@/lib/data";
import MiamiClient from "./MiamiClient";

export default async function MiamiPage() {
  const spots = await getSpotsByCity("Miami");
  return <MiamiClient spots={spots} />;
}
