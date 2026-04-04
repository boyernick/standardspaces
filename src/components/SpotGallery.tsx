"use client";

import { useRef, useState, useCallback, useEffect, memo } from "react";
import { ChevronLeft, ChevronRight, X, Grid2x2 } from "lucide-react";

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

function Lightbox({
  images,
  name,
  index,
  onClose,
  onPrev,
  onNext,
  onGoTo,
}: {
  images: string[];
  name: string;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Reset loaded state when index changes
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  // Trigger direction animation on navigation
  const goNext = useCallback(() => {
    if (index < images.length - 1) {
      setDirection("left");
      onNext();
    }
  }, [index, images.length, onNext]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setDirection("right");
      onPrev();
    }
  }, [index, onPrev]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Clear direction after animation
  useEffect(() => {
    if (direction) {
      const t = setTimeout(() => setDirection(null), 300);
      return () => clearTimeout(t);
    }
  }, [direction, index]);

  // Touch/swipe handling
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }
  function handleTouchMove(e: React.TouchEvent) {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function handleTouchEnd() {
    if (touchDeltaX.current > 60) goPrev();
    else if (touchDeltaX.current < -60) goNext();
  }

  // Thumbnail range (show up to 9 centered on current)
  const thumbStart = Math.max(0, index - 4);
  const thumbEnd = Math.min(images.length, thumbStart + 9);
  const thumbs = images.slice(thumbStart, thumbEnd);

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{ animation: "lightbox-fade-in 0.2s ease-out" }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
      >
        <X size={20} strokeWidth={2} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 right-4 z-20 text-sm text-white/60 font-medium tabular-nums">
        {index + 1} / {images.length}
      </div>

      {/* Previous button */}
      {index > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}

      {/* Next button */}
      {index < images.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
      )}

      {/* Fullscreen image */}
      <div
        className="absolute inset-0 z-10"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`w-full h-full transition-all duration-300 ease-out ${
            direction === "left"
              ? "animate-slide-left"
              : direction === "right"
              ? "animate-slide-right"
              : ""
          }`}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            key={index}
            src={images[index]}
            alt={`${name} ${index + 1}`}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-contain select-none transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-10 pb-4 px-4">
          <div className="flex items-center justify-center gap-2">
            {thumbs.map((src, i) => {
              const realIdx = thumbStart + i;
              const isCurrent = realIdx === index;
              return (
                <button
                  key={realIdx}
                  onClick={() => {
                    if (realIdx === index) return;
                    setDirection(realIdx > index ? "left" : "right");
                    onGoTo(realIdx);
                  }}
                  className={`shrink-0 rounded-md overflow-hidden transition-all duration-200 ${
                    isCurrent
                      ? "w-16 h-16 ring-2 ring-white brightness-110"
                      : "w-14 h-14 brightness-50 hover:brightness-75"
                  }`}
                >
                  <img
                    src={src}
                    alt={`Thumbnail ${realIdx + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes lightbox-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
        .animate-slide-right {
          animation: slide-right 0.3s ease-out;
        }
        @keyframes slide-left {
          from { transform: translateX(60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-right {
          from { transform: translateX(-60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

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
      <div className="md:hidden relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {(realImages.length > 0 ? realImages : ["/placeholder.jpg"]).map((src, i) => (
            <div key={i} className="w-full shrink-0 snap-center aspect-[4/3]">
              <GalleryImage
                src={src}
                alt={`${name} ${i + 1}`}
                onClick={src !== "/placeholder.jpg" ? () => openLightbox(i) : undefined}
              />
            </div>
          ))}
        </div>
        {realImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm tabular-nums">
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
