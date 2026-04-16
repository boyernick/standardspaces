"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  aspectClassName?: string;
  roundedClassName?: string;
  /**
   * When true, the first image of the carousel is treated as high-priority
   * (eager load, fetchPriority=high, responsive sizes). Use for cards that
   * render above the fold on initial page load.
   */
  priority?: boolean;
  /**
   * next/image `sizes` attribute for the first slide. Defaults to a full-width
   * fallback; callers that know the grid layout should pass a better hint so
   * the browser can pick a smaller candidate.
   */
  sizes?: string;
}

export default function ImageCarousel({
  images,
  alt,
  aspectClassName = "aspect-[4/3]",
  roundedClassName = "rounded-xl",
  priority = false,
  sizes = "(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw",
}: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const swiped = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  const count = images.length;

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent((c) => (c - 1 + count) % count);
  };

  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent((c) => (c + 1) % count);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDelta.current = 0;
    swiped.current = false;
    directionLocked.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    touchDelta.current = dx;

    // Lock direction once movement exceeds threshold
    if (!directionLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      directionLocked.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }

    if (directionLocked.current === "horizontal") {
      // Prevent browser back/forward swipe and page scroll
      e.preventDefault();
      swiped.current = true;
    }
  };

  const onTouchEnd = () => {
    if (directionLocked.current === "horizontal" && Math.abs(touchDelta.current) > 50) {
      if (touchDelta.current < 0 && current < count - 1) {
        setCurrent((c) => c + 1);
      } else if (touchDelta.current > 0 && current > 0) {
        setCurrent((c) => c - 1);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchDelta.current = 0;
    directionLocked.current = null;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (swiped.current) {
      e.preventDefault();
      e.stopPropagation();
      swiped.current = false;
    }
  };

  return (
    <div
      className={`group/carousel relative ${aspectClassName} ${roundedClassName} overflow-hidden bg-neutral-100 dark:bg-neutral-800`}
      onClickCapture={onClickCapture}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Images */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {images.map((src, i) => {
          const isFirst = i === 0;
          const isPriority = isFirst && priority;
          return (
            <div
              key={i}
              className="relative w-full h-full shrink-0 bg-neutral-100 dark:bg-neutral-800"
              aria-label={`${alt} image ${i + 1}`}
            >
              {src !== "/placeholder.jpg" && (
                <Image
                  src={src}
                  alt={`${alt} ${i + 1}`}
                  fill
                  sizes={sizes}
                  // Only the first slide of an above-the-fold card gets priority.
                  // Everything else uses next/image's default lazy loading — the
                  // browser's IntersectionObserver picks them up as the user scrolls.
                  priority={isPriority}
                  // Next.js 16's Image doesn't always emit fetchpriority on the <img>
                  // itself; set it explicitly so the browser's resource scheduler
                  // gives the visible hero images their rightful priority lane.
                  fetchPriority={isPriority ? "high" : undefined}
                  className="object-cover spot-img"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Arrows */}
      {count > 1 && (
        <>
          {current > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-surface border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronLeft size={10} strokeWidth={1.5} />
            </button>
          )}
          {current < count - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-surface border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronRight size={10} strokeWidth={1.5} />
            </button>
          )}
        </>
      )}

      {/* Dot indicators */}
      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-[3px]">
          {images.map((_, i) => (
            <div
              key={i}
              className={`w-[5px] h-[5px] rounded-full transition-colors ${
                i === current ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
