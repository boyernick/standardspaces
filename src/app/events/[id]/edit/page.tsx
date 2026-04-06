import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getSpotById } from "@/lib/data";
import Navbar from "@/components/Navbar";
import NewEventClient from "../../new/NewEventClient";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();
  if (event.host_id !== user.id) redirect(`/events/${id}`);

  const spot = await getSpotById(event.spot_id);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <NewEventClient initialSpot={spot} existingEvent={event} />
    </div>
  );
}
