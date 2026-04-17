import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEventById, getRsvpsForEvent } from "@/lib/events";
import { getSpotById } from "@/lib/data";
import Navbar from "@/components/Navbar";
import EventClient from "./EventClient";
import TrackView from "@/components/TrackView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event not found | Standard Spaces" };
  const image = event.cover_image_url || event.images?.[0];
  return {
    title: `${event.title} | Standard Spaces`,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      siteName: "Standard Spaces",
      type: "website",
      images: image ? [{ url: image, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: event.description ?? undefined,
      images: image ? [image] : [],
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

  const [spot, rsvps, hostProfile] = await Promise.all([
    getSpotById(event.spot_id),
    getRsvpsForEvent(event.id),
    supabase.from("profiles").select("id, first_name, last_name, avatar_url, instagram").eq("id", event.host_id).single().then((r) => r.data),
  ]);

  const attendeeIds = rsvps.map((r) => r.user_id);

  // Fetch attendee profiles and the viewer's follow set in parallel.
  const [attendeeProfilesRes, followsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", attendeeIds.length ? attendeeIds : ["00000000-0000-0000-0000-000000000000"]),
    user && attendeeIds.length > 0
      ? supabase
          .from("user_follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", attendeeIds)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
  ]);
  const attendeeProfiles = attendeeProfilesRes.data;
  const connectedIds = new Set(
    (followsRes.data ?? []).map((f) => f.following_id as string),
  );

  const myRsvp = user ? rsvps.find((r) => r.user_id === user.id) ?? null : null;
  const goingCount = rsvps.filter((r) => r.status === "going").length;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <TrackView kind="event" eventId={event.id} />
      <Navbar />
      <EventClient
        event={event}
        spot={spot}
        host={hostProfile}
        attendees={(attendeeProfiles ?? []).map((p) => {
          const r = rsvps.find((x) => x.user_id === p.id);
          return { ...p, status: r?.status ?? "going", isConnected: connectedIds.has(p.id) };
        })}
        goingCount={goingCount}
        myRsvp={myRsvp}
        viewerId={user?.id ?? null}
      />
    </div>
  );
}
