"use client";

import { useRef, useEffect } from "react";

export default function LandingVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = 0.6;
  }, []);

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-[65vw] aspect-[6/4] overflow-hidden"
      style={{ mask: "radial-gradient(ellipse at center, black 30%, transparent 80%)", WebkitMask: "radial-gradient(ellipse at center, black 30%, transparent 80%)" }}
    >
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
      >
        <source src="/landing-bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
