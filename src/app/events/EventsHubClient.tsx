"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventCard from "@/components/EventCard";
import { EventRecord } from "@/lib/types";
import { cancelEvent } from "@/app/actions/events";
import { Calendar, Mail, CalendarPlus } from "lucide-react";

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
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function EventsHubClient({ invitations, going, hosting, pastHosting, spotNames }: Props) {
  const [tab, setTab] = useState<Tab>("invitations");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "invitations", label: "Invitations", count: invitations.length },
    { id: "going", label: "Going", count: going.length },
    { id: "hosting", label: "Hosting", count: hosting.length },
  ];

  const active =
    tab === "invitations" ? invitations : tab === "going" ? going : hosting;
  const emptyState =
    tab === "invitations"
      ? { icon: Mail, title: "No pending invitations", body: "You'll see event invitations here when hosts add you." }
      : tab === "going"
      ? { icon: Calendar, title: "Nothing on your calendar", body: "You haven't RSVP'd to any upcoming events." }
      : { icon: CalendarPlus, title: "No events yet", body: "You haven't created any events yet." };
  const EmptyIcon = emptyState.icon;

  return (
    <>
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-6">
        {tabs.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 text-xs text-neutral-400">{t.count}</span>
              )}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-neutral-900 dark:bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {active.length === 0 ? (
        <div className="px-6 py-20 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#eceae2] dark:bg-[#0e0d07]">
            <EmptyIcon size={20} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
          </div>
          <h3 className="text-base font-medium">{emptyState.title}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
            {emptyState.body}
          </p>
        </div>
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
          <h2 className="text-sm font-semibold text-neutral-500 mb-4">Past hosted</h2>
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
