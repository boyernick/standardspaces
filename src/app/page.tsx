import type { Metadata } from "next";
import Link from "next/link";
import LandingVideo from "@/components/LandingVideo";
import LandingTheme from "@/components/LandingTheme";

export const metadata: Metadata = {
  other: { "theme-color": "#E8E0D0" },
};

export default function Home() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden" style={{ backgroundColor: "#E8E0D0" }}>
      <LandingTheme />
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-1">
          <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5" />
          <span className="text-lg tracking-tight text-black whitespace-nowrap" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
            Standard Spaces
          </span>
        </div>
        {/* Desktop buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-3 py-1.5 text-sm font-medium text-black/60 hover:text-black transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Sign in
          </Link>
          <Link
            href="/apply"
            className="px-5 py-2 text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/5 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Apply to join
          </Link>
        </div>
        {/* Mobile sign in button */}
        <Link
          href="/login"
          className="md:hidden px-4 py-1.5 text-sm font-medium text-black/60 hover:text-black transition-colors"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          Sign in
        </Link>
      </div>

      {/* Mobile fixed bottom apply CTA */}
      <div className="absolute bottom-0 inset-x-0 z-10 md:hidden px-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-3">
        <Link
          href="/apply"
          className="block w-full py-3 text-center text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/5 transition-colors"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          Apply to join
        </Link>
      </div>

      {/* Video overlay — covers viewport */}
      <LandingVideo />
    </div>
  );
}
