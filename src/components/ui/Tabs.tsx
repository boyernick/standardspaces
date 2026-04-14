"use client";

/**
 * Underline-style tab bar. Extracted from EventsHubClient + ProfileClient,
 * which had drifted slightly. Now both (and future tab uses) share.
 *
 * Controlled: parent owns the `value` state.
 */
export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-6">
      {tabs.map((t) => {
        const isActive = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative px-4 py-3 text-sm transition-colors duration-[var(--duration-fast)] ${
              isActive
                ? "text-neutral-900 dark:text-white font-semibold"
                : "text-neutral-500 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-1.5 text-xs text-neutral-400">{t.count}</span>
            )}
            {isActive && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}
