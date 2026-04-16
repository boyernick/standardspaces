/**
 * Shown on the space detail page under the description. Renders the member
 * average when the space has at least AGGREGATE_MIN_COUNT ratings; otherwise
 * renders nothing. Rating entry is driven entirely by the check-in flow, so
 * this component has no interactive controls.
 */
export default function SpotRatingInline({
  initialAggregate,
}: {
  initialAggregate: { avg: number; count: number } | null;
}) {
  if (!initialAggregate) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400">
        Members rate this{" "}
        <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
          {initialAggregate.avg.toFixed(1)}
        </span>{" "}
        <span className="text-neutral-400 dark:text-neutral-500">
          · {initialAggregate.count} ratings
        </span>
      </span>
    </div>
  );
}
