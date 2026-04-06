import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { EventRecord } from "@/lib/types";
import EventCard from "./EventCard";

interface Props {
  events: EventRecord[];
  spotNames?: Record<string, string>;
  title?: string;
  hostHref?: string;
}

export default function UpcomingEventsStrip({
  events,
  spotNames,
  title = "Upcoming events",
  hostHref,
}: Props) {
  if (events.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {hostHref && (
          <Link
            href={hostHref}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <CalendarPlus size={12} />
            Host an event
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-hide">
        {events.map((event) => (
          <div key={event.id} className="snap-start">
            <EventCard event={event} spotName={spotNames?.[event.spot_id]} />
          </div>
        ))}
      </div>
    </div>
  );
}
