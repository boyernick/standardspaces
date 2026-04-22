/**
 * Skeleton for the profile route. Mirrors PageShell: 60px navbar, constrained
 * max-w-2xl content. Profile header puts name + city + bio on the left and
 * the circular avatar on the right; stats sit below with an Instagram chip;
 * then a pair of action buttons (Edit profile + Settings), the tab bar, and
 * a list of spot rows matching the default Favorites view.
 */
export default function ProfileLoading() {
  const rows = Array.from({ length: 4 });

  return (
    <div className="h-full overflow-hidden bg-surface" aria-hidden="true">
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

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {/* Header: name + city + bio (left), avatar (right) */}
        <div className="flex items-center gap-4 mb-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="shimmer h-7 w-48 rounded-sm" />
            <div className="shimmer h-4 w-20 rounded-sm" />
            <div className="shimmer h-4 w-56 rounded-sm" />
          </div>
          <div className="shrink-0 shimmer w-20 h-20 rounded-full" />
        </div>

        {/* Stats + IG */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="shimmer h-4 w-20 rounded-sm" />
            <div className="shimmer h-4 w-24 rounded-sm" />
          </div>
          <div className="shimmer w-8 h-8 rounded-full" />
        </div>

        {/* Action buttons (Edit profile + Settings) */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="shimmer h-10 rounded-md" />
          <div className="shimmer h-10 rounded-md" />
        </div>

        {/* Tabs row */}
        <div className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-20 rounded-sm mb-3" />
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
        </div>

        {/* List of spot rows */}
        <div className="space-y-1">
          {rows.map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="shimmer w-12 h-12 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="shimmer h-4 w-40 rounded-sm" />
                <div className="shimmer h-3 w-28 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
