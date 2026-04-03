"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export default function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const swiped = useRef(false);

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
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
    swiped.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    touchDelta.current = e.touches[0].clientX - touchStart.current;
    if (Math.abs(touchDelta.current) > 10) {
      swiped.current = true;
    }
  };

  const onTouchEnd = () => {
    if (Math.abs(touchDelta.current) > 50) {
      if (touchDelta.current < 0 && current < count - 1) {
        setCurrent((c) => c + 1);
      } else if (touchDelta.current > 0 && current > 0) {
        setCurrent((c) => c - 1);
      }
    }
    touchStart.current = null;
    touchDelta.current = 0;
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
      className="group/carousel relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800"
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
        {images.map((src, i) => (
          <div
            key={i}
            className="relative w-full h-full shrink-0 bg-neutral-100 dark:bg-neutral-800"
            aria-label={`${alt} image ${i + 1}`}
          >
            {src !== "/placeholder.jpg" && (
              <img
                src={src}
                alt={`${alt} ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full h-full object-cover spot-img"
              />
            )}
          </div>
        ))}
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === current ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
