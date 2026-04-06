import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEventById, getRsvpsForEvent, getInvitedUserIds } from "@/lib/events";
import { getSpotById } from "@/lib/data";
import Navbar from "@/components/Navbar";
import EventClient from "./EventClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event not found | Standard Spaces" };
  return {
    title: `${event.title} | Standard Spaces`,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.cover_image_url ? [{ url: event.cover_image_url }] : [],
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [spot, rsvps, invitedUserIds, hostProfile] = await Promise.all([
    getSpotById(event.spot_id),
    getRsvpsForEvent(event.id),
    event.host_id === user?.id ? getInvitedUserIds(event.id) : Promise.resolve([] as string[]),
    supabase.from("profiles").select("id, first_name, last_name, avatar_url, instagram").eq("id", event.host_id).single().then((r) => r.data),
  ]);

  const attendeeIds = rsvps.map((r) => r.user_id);
  const { data: attendeeProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", attendeeIds.length ? attendeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const myRsvp = user ? rsvps.find((r) => r.user_id === user.id) ?? null : null;
  const goingCount = rsvps.filter((r) => r.status === "going").length;
  const isHost = !!user && user.id === event.host_id;

  // For private-event hosts, also load invitee profiles for the manage-invites UI
  let inviteeProfiles: Array<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; instagram: string | null }> = [];
  if (isHost && event.visibility === "private" && invitedUserIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, instagram")
      .in("id", invitedUserIds);
    inviteeProfiles = data ?? [];
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <EventClient
        event={event}
        spot={spot}
        host={hostProfile}
        attendees={(attendeeProfiles ?? []).map((p) => {
          const r = rsvps.find((x) => x.user_id === p.id);
          return { ...p, status: r?.status ?? "going" };
        })}
        goingCount={goingCount}
        myRsvp={myRsvp}
        isHost={isHost}
        invitedUserIds={invitedUserIds}
        invitees={inviteeProfiles}
        viewerId={user?.id ?? null}
      />
    </div>
  );
}
