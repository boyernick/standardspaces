/**
 * Skeleton for /recommend. PageShell + title + right-aligned CTA, tab bar,
 * and a list of recommendation rows (name/url on the left, timestamp on
 * the right).
 */
export default function RecommendLoading() {
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
          <div className="shimmer h-8 w-56 rounded-sm" />
          <div className="shimmer h-10 w-44 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="shimmer h-4 w-16 rounded-sm mb-3" />
          <div className="shimmer h-4 w-20 rounded-sm mb-3" />
        </div>

        {/* Recommendation rows */}
        <ul className="space-y-2">
          {rows.map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="shimmer h-4 w-40 rounded-sm" />
                <div className="shimmer h-3 w-56 rounded-sm" />
              </div>
              <div className="shimmer h-3 w-14 rounded-sm shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
