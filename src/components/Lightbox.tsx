"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Lock, Trash2, Unlock, Upload, X } from "lucide-react";

/**
 * Optional admin-only affordances over the current photo. When `actions`
 * is omitted (member spot gallery, event detail, etc.) the Lightbox
 * renders as a pure viewer. When provided (admin PhotoManager), a
 * hover-revealed toolbar floats over the image with Lock/Unlock,
 * Replace, and Remove buttons keyed to the currently-visible photo.
 */
export interface LightboxActions {
  locked?: boolean;
  onToggleLock?: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export interface LightboxProps {
  images: string[];
  name: string;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  actions?: LightboxActions;
}

/**
 * Full-screen image viewer with keyboard / swipe navigation and a
 * thumbnail strip. Extracted from SpotGallery so it can be reused by
 * the admin photo managers.
 */
export default function Lightbox({
  images,
  name,
  index,
  onClose,
  onPrev,
  onNext,
  onGoTo,
  actions,
}: LightboxProps) {
  const [loaded, setLoaded] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    setLoaded(false);
  }, [index]);

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

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (direction) {
      const t = setTimeout(() => setDirection(null), 300);
      return () => clearTimeout(t);
    }
  }, [direction, index]);

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

  const thumbStart = Math.max(0, index - 4);
  const thumbEnd = Math.min(images.length, thumbStart + 9);
  const thumbs = images.slice(thumbStart, thumbEnd);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{ animation: "lightbox-fade-in 0.2s ease-out" }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
      >
        <X size={20} strokeWidth={2} />
      </button>

      <div className="absolute top-4 right-4 z-20 text-sm text-white/60 font-medium tabular-nums">
        {index + 1} / {images.length}
      </div>

      {/* Admin action toolbar — sibling of the close button at z-20 so it
          sits above the click-zone overlay (which otherwise intercepts
          and dismisses). Keyed to the currently-visible photo by the
          parent; prev/next swap the `actions` closures out each render. */}
      {actions && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md">
          {actions.onToggleLock && (
            <button
              type="button"
              onClick={actions.onToggleLock}
              aria-pressed={actions.locked}
              title={actions.locked ? "Unlock — allow re-scrape to replace" : "Lock — preserve through re-scrapes"}
              className={`p-2 rounded-md transition-colors ${
                actions.locked
                  ? "bg-white text-neutral-900"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {actions.locked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
          )}
          {actions.onReplace && (
            <button
              type="button"
              onClick={actions.onReplace}
              title="Replace photo"
              className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Upload size={16} />
            </button>
          )}
          {actions.onRemove && (
            <button
              type="button"
              onClick={actions.onRemove}
              title="Remove photo"
              className="p-2 rounded-md text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

      {index > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white/80 backdrop-blur-lg hover:bg-black/60 hover:text-white transition-all"
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
      )}

      <div
        className="absolute inset-0 z-10 flex items-center justify-center px-12 md:px-20 pt-14 pb-24"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`group/lb relative max-w-5xl w-full h-full flex items-center justify-center transition-all duration-300 ease-out ${
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
            className={`max-w-full max-h-full object-contain rounded-lg select-none transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        </div>
      </div>

      {images.length > 1 && (
        // z-20 puts the thumbnail strip above the z-10 click-zone; without
        // this the big dismiss overlay covers the strip and swallows every
        // thumbnail click as a backdrop dismiss.
        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/60 to-transparent pt-10 pb-4 px-4">
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
    </div>,
    document.body,
  );
}
