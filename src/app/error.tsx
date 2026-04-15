"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface unexpected failures in dev and (once wired) to Sentry.
    console.error(error);
  }, [error]);

  return (
    <div
      className="h-full flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="text-center max-w-md">
        <p className="text-xs tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">
          Something went wrong
        </p>
        <h1
          className="text-3xl text-neutral-900 dark:text-white mb-3"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          We hit an unexpected error
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Try again, or head back home. If this keeps happening, please let us
          know.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset} variant="primary">
            Try again
          </Button>
          <ButtonLink href="/">Back home</ButtonLink>
        </div>
        {error.digest && (
          <p className="text-[10px] text-neutral-300 dark:text-neutral-600 mt-6 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
