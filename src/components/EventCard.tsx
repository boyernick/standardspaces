import Link from "next/link";
import { EventRecord } from "@/lib/types";

interface Props {
  event: EventRecord;
  spotName?: string;
}

export default function EventCard({ event, spotName }: Props) {
  const d = new Date(event.starts_at);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const priceLabel = event.price_cents === 0 ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block w-[260px] shrink-0 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-[box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)]"
    >
      <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-900 relative">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover spot-img group-hover:scale-[1.02] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-700">
            <div className="text-4xl font-semibold">{day}</div>
          </div>
        )}
        <div className="absolute top-2 left-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-lg px-2 py-1 flex flex-col items-center leading-none">
          <span className="text-[9px] font-medium text-neutral-500">{month}</span>
          <span className="text-sm font-semibold">{day}</span>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold line-clamp-1">{event.title}</h3>
            {spotName && (
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{spotName}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold">{priceLabel}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{time}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
