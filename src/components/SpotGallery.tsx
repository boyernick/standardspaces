"use client";

import { useRef, useState } from "react";

interface SpotGalleryProps {
  images: string[];
  name: string;
}

export default function SpotGallery({ images, name }: SpotGalleryProps) {
  // Pad to 5 images for the grid
  const imgs = [...images];
  while (imgs.length < 5) imgs.push("/placeholder.jpg");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const realImages = images.length > 0 ? images : ["/placeholder.jpg"];

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setScrollIndex(idx);
  }

  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="md:hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {realImages.map((src, i) => (
            <div key={i} className="w-full shrink-0 snap-center aspect-[4/3] bg-neutral-100">
              <img src={src} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        {/* Dots indicator */}
        {realImages.length > 1 && (
          <div className="flex justify-center gap-1.5 py-3">
            {realImages.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === scrollIndex ? "bg-neutral-900" : "bg-neutral-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[400px] rounded-xl overflow-hidden">
          {/* Hero — spans 2 cols, 2 rows */}
          <div className="col-span-2 row-span-2 bg-neutral-100 relative group cursor-pointer">
            {imgs[0] !== "/placeholder.jpg" ? (
              <img src={imgs[0]} alt={`${name} 1`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
          </div>

          {/* Top right pair */}
          <div className="bg-neutral-100 relative">
            {imgs[1] !== "/placeholder.jpg" ? (
              <img src={imgs[1]} alt={`${name} 2`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
          </div>
          <div className="bg-neutral-100 relative">
            {imgs[2] !== "/placeholder.jpg" ? (
              <img src={imgs[2]} alt={`${name} 3`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
          </div>

          {/* Bottom right pair */}
          <div className="bg-neutral-100 relative">
            {imgs[3] !== "/placeholder.jpg" ? (
              <img src={imgs[3]} alt={`${name} 4`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
          </div>
          <div className="bg-neutral-100 relative">
            {imgs[4] !== "/placeholder.jpg" ? (
              <img src={imgs[4]} alt={`${name} 5`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
