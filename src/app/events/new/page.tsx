import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getSpotById } from "@/lib/data";
import Navbar from "@/components/Navbar";
import NewEventClient from "./NewEventClient";

export const metadata: Metadata = { title: "Host an event" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const initialSpot = sp.spot ? await getSpotById(sp.spot) : null;

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <NewEventClient initialSpot={initialSpot} />
    </div>
  );
}
