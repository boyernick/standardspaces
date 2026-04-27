"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Bottom-centered status toast. Portaled to body so it sits above
 * transformed/scrolled ancestors. Auto-dismisses after `duration` ms.
 */
export default function Toast({
  message,
  onDismiss,
  duration = 2200,
}: {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[120] px-4 py-2 rounded-full bg-neutral-900/95 text-white text-sm font-medium shadow-lg animate-[fadeSlideDown_180ms_ease-out] dark:bg-white/95 dark:text-neutral-900"
    >
      {message}
    </div>,
    document.body,
  );
}
