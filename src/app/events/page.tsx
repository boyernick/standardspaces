import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import {
  getEventsByHost,
  getInvitesForUser,
  getUpcomingAttendingEvents,
} from "@/lib/events";
import { getSpotsByIds } from "@/lib/data";
import Navbar from "@/components/Navbar";
import EventCard from "@/components/EventCard";
import { EventRecord } from "@/lib/types";

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

  // Hosting: only show non-hidden, future first
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90"
          >
            <CalendarPlus size={14} />
            Host an event
          </Link>
        </div>

        <Section title="Hosting" events={upcomingHosting} spotNames={spotNames} emptyText="You haven't created any events yet." />
        <Section title="Invitations" events={invited} spotNames={spotNames} emptyText="No pending invitations." />
        <Section title="Going" events={attending} spotNames={spotNames} emptyText="You haven't RSVP'd to any upcoming events." />
        {pastHosting.length > 0 && (
          <Section title="Past hosted" events={pastHosting} spotNames={spotNames} emptyText="" />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  events,
  spotNames,
  emptyText,
}: {
  title: string;
  events: EventRecord[];
  spotNames: Record<string, string>;
  emptyText: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {events.length === 0 ? (
        emptyText && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</p>
        )
      ) : (
        <div className="flex flex-wrap gap-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} spotName={spotNames[e.spot_id]} />
          ))}
        </div>
      )}
    </section>
  );
}
