"use client";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: "#F7F7F3" }}>
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-1">
          <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5" />
          <span className="text-lg tracking-tight text-black whitespace-nowrap" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
            Standard Spaces
          </span>
        </div>
        <button className="px-5 py-2 text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/5 transition-colors" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
          Apply to join
        </button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center px-5 py-4">
        <span className="text-xs text-black/40" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
          A curated guide to the spaces worth knowing.
        </span>
      </div>

      {/* Video overlay — covers viewport */}
      <video
        autoPlay
        muted
        loop
        playsInline
        ref={(el) => { if (el) el.playbackRate = 0.33; }}
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/landing-bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
