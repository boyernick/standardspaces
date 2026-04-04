"use client";

import { useRef, useEffect, useState } from "react";

export function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        animation: `fadeInUp 0.5s cubic-bezier(0.25,0.1,0.25,1) ${delay}s both`,
      }}
    >
      {children}
    </div>
  );
}

export function GalleryReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        animation: "galleryReveal 0.6s cubic-bezier(0.25,0.1,0.25,1) both",
      }}
    >
      {children}
    </div>
  );
}

export function SectionReveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "-50px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s cubic-bezier(0.25,0.1,0.25,1) ${delay}s, transform 0.5s cubic-bezier(0.25,0.1,0.25,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
