"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventCard from "@/components/EventCard";
import { EventRecord } from "@/lib/types";
import { cancelEvent } from "@/app/actions/events";
import { Calendar, Mail, CalendarPlus } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";

type Tab = "invitations" | "going" | "hosting";

interface Props {
  invitations: EventRecord[];
  going: EventRecord[];
  hosting: EventRecord[];
  pastHosting: EventRecord[];
  spotNames: Record<string, string>;
}

function HostedEventCard({ event, spotName }: { event: EventRecord; spotName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isCancelled = event.status === "cancelled";

  function handleCancel() {
    if (!confirm("Cancel this event? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await cancelEvent(event.id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="relative w-[260px] shrink-0">
      <EventCard event={event} spotName={spotName} />
      {!isCancelled && (
        <div className="mt-2 flex items-center gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function EventsHubClient({ invitations, going, hosting, pastHosting, spotNames }: Props) {
  const [tab, setTab] = useState<Tab>("going");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "going", label: "Going", count: going.length },
    { id: "invitations", label: "Invitations", count: invitations.length },
    { id: "hosting", label: "Hosting", count: hosting.length },
  ];

  const active =
    tab === "invitations" ? invitations : tab === "going" ? going : hosting;
  const emptyState =
    tab === "invitations"
      ? { icon: Mail, title: "No pending invitations", body: "You'll see event invitations here when hosts add you." }
      : tab === "going"
      ? {
          icon: Calendar,
          title: "Nothing on your calendar",
          body: "Browse what's happening around the city and RSVP to fill it up.",
          // Deep-links to the city feed with the Events filter already
          // toggled so the user lands on an events-only view.
          cta: { label: "Explore events", href: "/miami?events=1" },
        }
      : { icon: CalendarPlus, title: "No events", body: "You haven't created any events." };

  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {active.length === 0 ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          body={emptyState.body}
          cta={"cta" in emptyState ? emptyState.cta : undefined}
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {active.map((e) =>
            tab === "hosting" ? (
              <HostedEventCard key={e.id} event={e} spotName={spotNames[e.spot_id]} />
            ) : (
              <EventCard key={e.id} event={e} spotName={spotNames[e.spot_id]} />
            )
          )}
        </div>
      )}

      {tab === "hosting" && pastHosting.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">Previously hosted</h2>
          <div className="flex flex-wrap gap-4">
            {pastHosting.map((e) => (
              <EventCard key={e.id} event={e} spotName={spotNames[e.spot_id]} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
