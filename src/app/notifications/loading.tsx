/**
 * Skeleton for the notifications route. Mirrors PageShell: 60px navbar,
 * constrained max-w-2xl content. Title row + tab bar + list of notification
 * rows (cover tile or circular avatar on the left, 2-line text on the right).
 */
export default function NotificationsLoading() {
  const rows = Array.from({ length: 6 });

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
        {/* Page title */}
        <div className="mb-8">
          <div className="shimmer h-8 w-44 rounded-sm" />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="shimmer h-4 w-12 rounded-sm mb-3" />
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-20 rounded-sm mb-3" />
        </div>

        {/* Notification rows — alternating cover-tile / avatar leading image */}
        <ul>
          {rows.map((_, i) => {
            const isCover = i % 2 === 0;
            return (
              <li key={i} className="flex items-start gap-3 px-3 py-3">
                {isCover ? (
                  <div className="shimmer w-12 h-12 rounded-lg shrink-0" />
                ) : (
                  <div className="shimmer w-10 h-10 rounded-full shrink-0" />
                )}
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className="shimmer h-4 w-2/3 rounded-sm" />
                  <div className="shimmer h-3 w-1/3 rounded-sm" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
