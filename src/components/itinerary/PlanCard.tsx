import Link from "next/link";
import type { Itinerary } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";

// Card render for a saved plan on the /plans hub.
//
// What matters for recognizing a plan is which spaces are in it — not
// the date it was created, not the city (every plan belongs to a
// single city the user already knows from context). So the card is
// pure media: a grid of up to four stop photos, sized and arranged to
// fill the whole card. The only text is a small "N spaces" pill so a
// plan with one resolvable photo still reads as more than that one
// space. Tap anywhere to open the saved-plan editor.

interface Props {
  plan: Itinerary;
  /** Ordered thumbnails from the plan's first stops, already filtered
   *  to non-null images by the server. */
  thumbs: string[];
}

export default function PlanCard({ plan, thumbs }: Props) {
  const stopCount = plan.items.length;

  return (
    <Link
      href={`/${citySlugFromName(plan.city)}/itinerary/${plan.id}`}
      aria-label={`Open plan with ${stopCount} ${stopCount === 1 ? "space" : "spaces"}`}
      className="group relative block w-[240px] shrink-0 aspect-square rounded-3xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] hover:scale-[1.015]"
    >
      <PhotoGrid thumbs={thumbs} fallback={stopCount} />

      {/* Stop-count pill — bottom-left, small, on a soft white chip so
          it stays readable over any photo. This is the only copy on
          the card; photos carry the rest. */}
      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-neutral-900 text-[11px] font-medium tabular-nums shadow-sm">
        {stopCount} {stopCount === 1 ? "space" : "spaces"}
      </div>
    </Link>
  );
}

/** Layout up to four thumbnails edge-to-edge with a 2px seam between
 *  tiles. Arrangement adapts to however many photos actually resolved:
 *  - 0 → blank plate with a muted stop-count glyph.
 *  - 1 → full bleed.
 *  - 2 → two equal halves (side by side).
 *  - 3 → one left half + two stacked on the right half.
 *  - 4+ → 2x2.
 */
function PhotoGrid({
  thumbs,
  fallback,
}: {
  thumbs: string[];
  fallback: number;
}) {
  if (thumbs.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-6xl font-semibold">
        {fallback || "—"}
      </div>
    );
  }

  if (thumbs.length === 1) {
    return (
      <div className="absolute inset-0">
        <Tile src={thumbs[0]} />
      </div>
    );
  }

  if (thumbs.length === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        <Tile src={thumbs[0]} />
        <Tile src={thumbs[1]} />
      </div>
    );
  }

  if (thumbs.length === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        <div className="row-span-2">
          <Tile src={thumbs[0]} />
        </div>
        <Tile src={thumbs[1]} />
        <Tile src={thumbs[2]} />
      </div>
    );
  }

  // 4+
  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
      <Tile src={thumbs[0]} />
      <Tile src={thumbs[1]} />
      <Tile src={thumbs[2]} />
      <Tile src={thumbs[3]} />
    </div>
  );
}

function Tile({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover spot-img transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
    />
  );
}
