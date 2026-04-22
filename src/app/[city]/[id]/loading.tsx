/**
 * Skeleton for the space detail route. Mirrors the real layout: 60px navbar,
 * hero gallery (full-bleed 4:3 on mobile, 3-up square grid on desktop),
 * title + description + info rows, and the bottom action bar.
 */
export default function SpotLoading() {
  return (
    <div className="h-[100dvh] flex flex-col bg-surface" aria-hidden="true">
      {/* Navbar placeholder — matches real 60px height. */}
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
        {/* Gallery */}
        <div className="md:hidden px-3">
          <div className="shimmer w-full aspect-[4/3] rounded-2xl" />
        </div>
        <div className="hidden md:block px-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="shimmer aspect-square rounded-lg" />
            <div className="shimmer aspect-square rounded-lg" />
            <div className="shimmer aspect-square rounded-lg" />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-7 space-y-3">
          <div className="flex gap-2">
            <div className="shimmer h-6 w-20 rounded-full" />
            <div className="shimmer h-6 w-24 rounded-full" />
          </div>
          <div className="shimmer h-8 w-2/3 rounded-sm" />
          <div className="space-y-2">
            <div className="shimmer h-4 w-full rounded-sm" />
            <div className="shimmer h-4 w-11/12 rounded-sm" />
            <div className="shimmer h-4 w-3/4 rounded-sm" />
          </div>
          <div className="pt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
                <div className="shimmer w-5 h-5 rounded-sm shrink-0" />
                <div className="shimmer h-4 w-40 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="shimmer h-10 flex-1 rounded-full" />
          <div className="shimmer h-10 w-10 rounded-full shrink-0" />
        </div>
      </div>
    </div>
  );
}
