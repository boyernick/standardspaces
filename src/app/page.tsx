import Link from "next/link";
import LandingVideo from "@/components/LandingVideo";
import LandingMenu from "@/components/LandingMenu";

export default function Home() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-surface">
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
        {/* Mobile hamburger */}
        <LandingMenu />
      </div>


      {/* Background */}
      <div className="absolute inset-0" style={{ backgroundColor: "#E8E0D0" }} />

      {/* Video overlay — covers viewport */}
      <LandingVideo />
    </div>
  );
}
