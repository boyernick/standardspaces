/**
 * Skeleton shown while the [city] route fetches data. Mirrors CityClient's
 * layout so the handoff from skeleton → real content doesn't shift: 60px
 * navbar (logo + search + user menu), filter-chip row, card grid on the
 * left panel, rounded map panel on the right at the split breakpoint.
 * Aria-hidden — the real content is announced when it arrives.
 */
export default function CityLoading() {
  // Six card placeholders fill the above-the-fold grid on most viewports
  // without padding the DOM with rows a user won't see before handoff.
  const cards = Array.from({ length: 6 });

  return (
    <div className="h-screen flex flex-col bg-surface" aria-hidden="true">
      {/* Navbar — matches the real 60px height so nothing shifts on handoff. */}
      <header className="bg-surface shrink-0 h-[60px] px-4 flex items-center">
        {/* Left: logo + wordmark */}
        <div className="flex-1 flex items-center gap-2">
          <div className="shimmer h-5 w-5 rounded-sm" />
          <div className="shimmer h-4 w-36 rounded-sm" />
        </div>

        {/* Center: search pill (desktop only, like the real navbar) */}
        <div className="hidden md:block shimmer h-9 w-[280px] rounded-full" />

        {/* Right: user menu pill */}
        <div className="flex-1 flex justify-end">
          <div className="shimmer h-10 w-[76px] rounded-full" />
        </div>
      </header>

      {/* Filter chip row */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2 overflow-hidden">
        <div className="shimmer h-8 w-20 rounded-full" />
        <div className="shimmer h-8 w-24 rounded-full" />
        <div className="shimmer h-8 w-20 rounded-full" />
        <div className="shimmer h-8 w-24 rounded-full" />
        <div className="shimmer h-8 w-20 rounded-full" />
      </div>

      {/* Panel (left) + map (right) — stacked under split, side-by-side at split. */}
      <div className="flex-1 min-h-0 flex flex-col split:flex-row">
        {/* Left panel — matches CityClient's `split:w-[55%] lg:w-1/2`. */}
        <div className="w-full split:w-[55%] lg:w-1/2 split:min-w-[420px] split:shrink-0 overflow-hidden p-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 split:grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-6 split:gap-x-3 split:gap-y-4">
            {cards.map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden card-edge">
                <div className="shimmer aspect-[16/10]" />
                <div className="p-3 bg-surface">
                  <div className="shimmer h-4 w-3/4 rounded-sm" />
                  <div className="shimmer h-3 w-1/2 rounded-sm mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right map — hidden below split, padded + rounded to match. */}
        <div className="hidden split:block split:flex-1 split:min-w-0 relative px-4 split:pl-0 split:pt-1.5 split:pb-4">
          <div className="w-full h-full rounded-2xl overflow-hidden shimmer" />
        </div>
      </div>
    </div>
  );
}
