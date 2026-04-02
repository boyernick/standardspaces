"use client";

import { useRef, useEffect } from "react";

export default function LandingVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = 0.33;
  }, []);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    >
      <source src="/landing-bg.mp4" type="video/mp4" />
    </video>
  );
}
