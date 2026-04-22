/**
 * Skeleton for the event detail route. Mirrors the real layout: 60px navbar,
 * event cover hero (4:3 on mobile, 3:1 on desktop), title + meta rows, host
 * tile, RSVP strip, and the bottom action bar.
 */
export default function EventLoading() {
  return (
    <div className="h-[100dvh] flex flex-col bg-surface" aria-hidden="true">
      {/* Navbar placeholder */}
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

      <div className="flex-1 overflow-hidden relative">
        {/* Cover — mobile 4:3 full-bleed, desktop 3:1 rounded strip */}
        <div className="md:hidden shimmer w-full aspect-[4/3]" />
        <div className="hidden md:block px-2">
          <div className="shimmer aspect-[3/1] rounded-lg" />
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-7 space-y-4">
          <div className="shimmer h-8 w-3/4 rounded-sm" />
          <div className="flex items-center gap-3">
            <div className="shimmer h-5 w-32 rounded-sm" />
            <div className="shimmer h-5 w-24 rounded-sm" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="shimmer h-4 w-full rounded-sm" />
            <div className="shimmer h-4 w-5/6 rounded-sm" />
            <div className="shimmer h-4 w-2/3 rounded-sm" />
          </div>

          {/* Host tile */}
          <div className="pt-4 flex items-center gap-3">
            <div className="shimmer w-11 h-11 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <div className="shimmer h-4 w-28 rounded-sm" />
              <div className="shimmer h-3 w-20 rounded-sm" />
            </div>
          </div>

          {/* Going row */}
          <div className="pt-4 space-y-3">
            <div className="shimmer h-4 w-32 rounded-sm" />
            <div className="flex">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="shimmer w-9 h-9 rounded-full ring-2 ring-[var(--color-surface)]"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 6 - i }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <div className="shimmer h-10 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
