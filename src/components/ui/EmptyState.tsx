import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "./Button";

/**
 * Canonical empty state: ocean circle + icon + h3 + body + optional CTA.
 * Pattern copied 6+ times across the app before extraction. Always use
 * this rather than hand-rolling — that's how drift starts.
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="px-6 py-24 text-center">
      <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-ink-100">
        <Icon
          size={22}
          strokeWidth={1.5}
          className="text-neutral-500 dark:text-neutral-400"
        />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {body && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
          {body}
        </p>
      )}
      {cta && (
        <div className="mt-6">
          <ButtonLink href={cta.href}>{cta.label}</ButtonLink>
        </div>
      )}
    </div>
  );
}
