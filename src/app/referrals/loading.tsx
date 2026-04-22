/**
 * Skeleton for /referrals. PageShell + title + right-aligned CTA, tab bar,
 * and a list of referral rows (name + status line on the left, icon action
 * buttons on the right).
 */
export default function ReferralsLoading() {
  const rows = Array.from({ length: 4 });

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
          <div className="shimmer h-8 w-36 rounded-sm" />
          <div className="shimmer h-10 w-36 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-12 rounded-sm mb-3" />
        </div>

        {/* Referral rows */}
        <div className="space-y-2">
          {rows.map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="shimmer h-4 w-36 rounded-sm" />
                <div className="shimmer h-3 w-20 rounded-sm" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="shimmer w-8 h-8 rounded-md" />
                <div className="shimmer w-8 h-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
