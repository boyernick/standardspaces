/**
 * Skeleton for /events. PageShell + title + right-aligned CTA, tab bar,
 * and a flex-wrap row of 260px event cards (16:10 cover image with a
 * rounded-lg date badge overlaid top-left, title + price row beneath).
 */
export default function EventsLoading() {
  const cards = Array.from({ length: 4 });

  return (
    <div className="h-full overflow-hidden bg-surface" aria-hidden="true">
      <header className="shrink-0 h-[60px] px-4 flex items-center">
        <div className="flex-1 flex items-center gap-2">
          <div className="shimmer h-5 w-5 rounded-sm" />
          <div className="shimmer h-4 w-36 rounded-sm" />
        </div>
        <div className="hidden md:block shimmer h-9 w-[280px] rounded-full" />
        <div className="flex-1 flex justify-end">
          <div className="shimmer h-10 w-[76px] rounded-full" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {/* Title + CTA */}
        <div className="flex items-center justify-between mb-8">
          <div className="shimmer h-8 w-28 rounded-sm" />
          <div className="shimmer h-10 w-36 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="shimmer h-4 w-20 rounded-sm mb-3" />
          <div className="shimmer h-4 w-14 rounded-sm mb-3" />
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
        </div>

        {/* Event cards */}
        <div className="flex flex-wrap gap-4">
          {cards.map((_, i) => (
            <div
              key={i}
              className="w-[260px] shrink-0 rounded-2xl overflow-hidden card-edge"
            >
              <div className="relative shimmer aspect-[16/10]">
                {/* Date badge placeholder, concentric with the 2xl outer */}
                <div className="absolute top-2 left-2 w-10 h-10 rounded-lg bg-surface/90" />
              </div>
              <div className="p-3 bg-surface">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="shimmer h-4 w-3/4 rounded-sm" />
                    <div className="shimmer h-3 w-1/2 rounded-sm" />
                  </div>
                  <div className="text-right shrink-0 space-y-2">
                    <div className="shimmer h-4 w-10 rounded-sm ml-auto" />
                    <div className="shimmer h-3 w-14 rounded-sm ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
