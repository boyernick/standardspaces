"use client";

import { useEffect, useState, useRef } from "react";

interface StickyBookingBarProps {
  name: string;
  priceRange?: string;
  bookingUrl: string;
  bookingLabel: string;
}

export default function StickyBookingBar({ name, priceRange, bookingUrl, bookingLabel }: StickyBookingBarProps) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Find the scroll container (overflow-y-auto parent)
    const scrollRoot = sentinel.closest("[class*='overflow-y-auto']") as Element | null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0, root: scrollRoot }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel — placed at the title position */}
      <div ref={sentinelRef} className="h-0 w-0" />

      {/* Sticky bar — hidden on mobile (has its own sticky bar) */}
      <div
        className={`hidden md:block fixed top-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800 transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            {priceRange && <p className="text-xs text-neutral-500 dark:text-neutral-400">{priceRange}</p>}
          </div>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center bg-black text-white dark:bg-white dark:text-black px-5 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            {bookingLabel}
          </a>
        </div>
      </div>
    </>
  );
}
