"use client";

import { useRef, useState, memo } from "react";
import { Grid2x2 } from "lucide-react";
import Lightbox from "./Lightbox";

interface SpotGalleryProps {
  images: string[];
  name: string;
}

const GalleryImage = memo(function GalleryImage({ src, alt, onClick }: { src: string; alt: string; onClick?: () => void }) {
  if (src === "/placeholder.jpg") {
    return <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />;
  }

  return (
    <div
      className={`relative w-full h-full bg-neutral-100 dark:bg-neutral-800 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover spot-img"
      />
    </div>
  );
});


export default function SpotGallery({ images, name }: SpotGalleryProps) {
  const imgs = [...images];
  while (imgs.length < 5) imgs.push("/placeholder.jpg");
  const realImages = images.length > 0 ? images : [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setScrollIndex(idx);
  }

  function openLightbox(index: number) {
    // Only open if it's a real image, not a placeholder
    if (images[index]) {
      setLightboxIndex(index);
    }
  }

  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="md:hidden relative px-3">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-2xl"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {(realImages.length > 0 ? realImages : ["/placeholder.jpg"]).map((src, i) => (
            <div key={i} className="w-full shrink-0 snap-center aspect-[4/3] overflow-hidden rounded-2xl">
              <GalleryImage
                src={src}
                alt={`${name} ${i + 1}`}
                onClick={src !== "/placeholder.jpg" ? () => openLightbox(i) : undefined}
              />
            </div>
          ))}
        </div>
        {realImages.length > 1 && (
          <div className="absolute bottom-3 right-6 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm tabular-nums">
            {scrollIndex + 1} / {realImages.length}
          </div>
        )}
      </div>

      {/* Desktop: 3-photo full-width strip */}
      <div className="hidden md:block">
        <div className="relative">
          <div className="grid grid-cols-3 gap-2 px-2">
            <div className="aspect-square overflow-hidden rounded-lg">
              <GalleryImage src={imgs[0]} alt={`${name} 1`} onClick={() => openLightbox(0)} />
            </div>
            <div className="aspect-square overflow-hidden rounded-lg">
              <GalleryImage src={imgs[1]} alt={`${name} 2`} onClick={() => openLightbox(1)} />
            </div>
            <div className="aspect-square overflow-hidden rounded-lg">
              <GalleryImage src={imgs[2]} alt={`${name} 3`} onClick={() => openLightbox(2)} />
            </div>
          </div>
          {realImages.length > 3 && (
            <button
              onClick={() => openLightbox(0)}
              className="absolute bottom-3 right-5 flex items-center gap-1.5 px-3 py-1.5 bg-surface/90 backdrop-blur-sm border border-neutral-300 dark:border-neutral-700 rounded-full text-xs font-medium hover:bg-surface transition-colors"
            >
              <Grid2x2 size={12} />
              All photos
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && realImages.length > 0 && (
        <Lightbox
          images={realImages}
          name={name}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(realImages.length - 1, (i ?? 0) + 1))}
          onGoTo={(i) => setLightboxIndex(i)}
        />
      )}
    </>
  );
}
