import Link from "next/link";
import type { Itinerary } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";

// Card render for a saved plan on the /plans hub. Shape mirrors
// EventCard's: 260px wide, 16/10 thumbnail with a corner chip, then
// title + short metadata. Entire card is a link into the saved-plan
// editor — Delete lives as a sibling button below the card (see
// PlansHubClient), not inside, so clicking Delete never also routes.

interface Props {
  plan: Itinerary;
  thumb: string | null;
}

export default function PlanCard({ plan, thumb }: Props) {
  const stopCount = plan.items.length;
  const dateLabel = formatPlanDate(plan.date);
  const displayName = plan.name?.trim() || "Untitled plan";

  return (
    <Link
      href={`/${citySlugFromName(plan.city)}/itinerary/${plan.id}`}
      className="group block w-[260px] shrink-0 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-[box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)]"
    >
      <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-900 relative">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover spot-img group-hover:scale-[1.02] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-700">
            <div className="text-4xl font-semibold">{stopCount || "—"}</div>
          </div>
        )}
        {/* City chip — top-left, mirrors EventCard's date chip placement. */}
        <div className="absolute top-2 left-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-lg px-2 py-1 text-[11px] font-medium">
          {plan.city}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold line-clamp-1">{displayName}</h3>
        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
          {stopCount} {stopCount === 1 ? "space" : "spaces"}
          {dateLabel ? ` · ${dateLabel}` : ""}
        </p>
      </div>
    </Link>
  );
}

// ISO yyyy-mm-dd → "Fri, Apr 25". Returns null for missing or malformed
// input so the caller can skip the "·" joiner cleanly.
function formatPlanDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
