"use client";

import { useRef, useState, useCallback } from "react";

interface SpotGalleryProps {
  images: string[];
  name: string;
}

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  if (src === "/placeholder.jpg") {
    return <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />;
  }

  return (
    <div className="relative w-full h-full bg-neutral-100 dark:bg-neutral-800">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-100 dark:bg-neutral-800" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover spot-img transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default function SpotGallery({ images, name }: SpotGalleryProps) {
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
            <div key={i} className="w-full shrink-0 snap-center aspect-[4/3]">
              <GalleryImage src={src} alt={`${name} ${i + 1}`} />
            </div>
          ))}
        </div>
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
          <div className="col-span-2 row-span-2">
            <GalleryImage src={imgs[0]} alt={`${name} 1`} />
          </div>
          <div><GalleryImage src={imgs[1]} alt={`${name} 2`} /></div>
          <div><GalleryImage src={imgs[2]} alt={`${name} 3`} /></div>
          <div><GalleryImage src={imgs[3]} alt={`${name} 4`} /></div>
          <div><GalleryImage src={imgs[4]} alt={`${name} 5`} /></div>
        </div>
      </div>
    </>
  );
}
