import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import {
  getEventsByHost,
  getInvitesForUser,
  getUpcomingAttendingEvents,
} from "@/lib/events";
import { getSpotsByIds } from "@/lib/data";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import EventsHubClient from "./EventsHubClient";

export const metadata: Metadata = { title: "Events" };

export default async function EventsHubPage() {
  const user = await requireAuth();

  const [hosting, invited, attending] = await Promise.all([
    getEventsByHost(user.id),
    getInvitesForUser(user.id),
    getUpcomingAttendingEvents(user.id),
  ]);

  const spotIds = [
    ...new Set([...hosting, ...invited, ...attending].map((e) => e.spot_id)),
  ];
  const spots = await getSpotsByIds(spotIds);
  const spotNames: Record<string, string> = {};
  for (const s of spots) spotNames[s.id] = s.name;

  const now = Date.now();
  const upcomingHosting = hosting
    .filter((e) => new Date(e.starts_at).getTime() >= now && e.status !== "hidden")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const pastHosting = hosting
    .filter((e) => new Date(e.starts_at).getTime() < now && e.status !== "hidden")
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="Events"
        action={<ButtonLink href="/events/new">Host an event</ButtonLink>}
      />
      <EventsHubClient
        invitations={invited}
        going={attending}
        hosting={upcomingHosting}
        pastHosting={pastHosting}
        spotNames={spotNames}
      />
    </PageShell>
  );
}
