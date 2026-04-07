import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import {
  getEventsByHost,
  getInvitesForUser,
  getUpcomingAttendingEvents,
} from "@/lib/events";
import { getSpotsByIds } from "@/lib/data";
import Navbar from "@/components/Navbar";
import EventsHubClient from "./EventsHubClient";

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
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Events</h1>
          <Link
            href="/events/new"
            className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90"
          >
            Host an event
          </Link>
        </div>

        <EventsHubClient
          invitations={invited}
          going={attending}
          hosting={upcomingHosting}
          pastHosting={pastHosting}
          spotNames={spotNames}
        />
      </div>
    </div>
  );
}
