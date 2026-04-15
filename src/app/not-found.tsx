import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div
      className="h-full flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="text-center max-w-md">
        <p className="text-xs tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">
          404
        </p>
        <h1
          className="text-3xl text-neutral-900 dark:text-white mb-3"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          Page not found
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          The page you were looking for doesn&apos;t exist, or was moved.
        </p>
        <ButtonLink href="/">Back to Standard Spaces</ButtonLink>
      </div>
    </div>
  );
}
