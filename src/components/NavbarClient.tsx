"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPendingReferralCount } from "@/app/actions/referrals";
import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { getAdminPendingCount } from "@/app/actions/admin";
import { getInitials } from "@/lib/initials";

// useLayoutEffect warns when it runs during SSR. This is a client component,
// but Next.js still renders it on the server for the initial HTML — so fall
// back to useEffect there to silence the warning, and use the real hook
// in the browser where it matters (runs after hydration but before paint).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface NavbarClientProps {
  // Server-prefetched initial values. When provided, the client skips the
  // localStorage flash + network round trips and renders the correct avatar
  // on first paint. Undefined means SSR data wasn't supplied; fall back to
  // the localStorage + client-fetch path.
  initialAvatarUrl?: string | null;
  initialDisplayName?: string | null;
  initialIsAdmin?: boolean;
  initialUnreadNotifs?: number;
  initialPendingReferrals?: number;
  initialAdminPending?: number;
}

export default function NavbarClient({
  initialAvatarUrl,
  initialDisplayName,
  initialIsAdmin,
  initialUnreadNotifs,
  initialPendingReferrals,
  initialAdminPending,
}: NavbarClientProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const citySlug = pathname.split("/")[1] || "miami";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin ?? false);
  const [pendingReferrals, setPendingReferrals] = useState(initialPendingReferrals ?? 0);
  const [unreadNotifs, setUnreadNotifs] = useState(initialUnreadNotifs ?? 0);
  // Combined count of pending applications + unpublished recommendations.
  // Admins only — non-admins always see 0.
  const [adminPending, setAdminPending] = useState(initialAdminPending ?? 0);
  // Forced on by `/notifications?mock=1` so the preview can show the jewel
  // state on the profile button without writing to the real db.
  const [mockJewel, setMockJewel] = useState(false);
  // Tri-state: undefined = unknown (don't render anything yet), null = signed
  // out / no avatar (render initials fallback), string = avatar URL.
  //
  // When the server prefetch ran, `initialAvatarUrl` is either a URL or
  // null (no avatar) — either way we start resolved, so no placeholder flash.
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    initialAvatarUrl === undefined ? undefined : initialAvatarUrl,
  );
  // Display name drives the initials fallback when no avatar is set.
  const [displayName, setDisplayName] = useState<string | null>(initialDisplayName ?? null);
  // Drives the soft shadow beneath the sticky navbar once the page has
  // scrolled away from the top. Lets the nav read as a floating layer over
  // content without adding visual weight when it sits flush at the top.
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Fallback hydration from localStorage for the rare case this component
  // mounts without server-prefetched initial props. When props are present,
  // the server values are already authoritative — skip the read so we don't
  // clobber fresher data with stale cache. Runs before paint.
  const hasServerInitial = initialAvatarUrl !== undefined;
  useIsomorphicLayoutEffect(() => {
    if (hasServerInitial) {
      // Still honor the mock-jewel flag so /notifications?mock=1 works.
      try {
        if (localStorage.getItem("navMockJewel") === "1") setMockJewel(true);
      } catch {}
      return;
    }
    try {
      const cached = localStorage.getItem("navAvatarUrl");
      if (cached) setAvatarUrl(cached);
      const cachedName = localStorage.getItem("navDisplayName");
      if (cachedName) setDisplayName(cachedName);
      const cachedUnread = localStorage.getItem("navUnreadCount");
      if (cachedUnread) setUnreadNotifs(parseInt(cachedUnread, 10) || 0);
      const cachedAdminPending = localStorage.getItem("navAdminPending");
      if (cachedAdminPending) setAdminPending(parseInt(cachedAdminPending, 10) || 0);
      if (localStorage.getItem("navMockJewel") === "1") setMockJewel(true);
    } catch {}
  }, [hasServerInitial]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      // Run user fetch + badge count fetches in parallel — none depend on each other.
      const [userRes, pendingCount, unreadCount, adminPendingCount] = await Promise.all([
        supabase.auth.getUser(),
        getPendingReferralCount(),
        getUnreadNotificationCount(),
        getAdminPendingCount(),
      ]);
      if (!cancelled) {
        setPendingReferrals(pendingCount);
        setUnreadNotifs(unreadCount);
        setAdminPending(adminPendingCount);
        try {
          localStorage.setItem("navUnreadCount", String(unreadCount));
          localStorage.setItem("navAdminPending", String(adminPendingCount));
        } catch {}
      }
      const user = userRes.data.user;
      if (cancelled) return;
      if (!user) {
        setAvatarUrl(null);
        setDisplayName(null);
        try {
          localStorage.removeItem("navAvatarUrl");
          localStorage.removeItem("navDisplayName");
        } catch {}
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role, avatar_url, first_name, last_name")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (data?.role === "admin") setIsAdmin(true);
      const nextAvatar = data?.avatar_url ?? null;
      const nextName =
        [data?.first_name, data?.last_name].filter(Boolean).join(" ") || null;
      setAvatarUrl(nextAvatar);
      setDisplayName(nextName);
      try {
        if (nextAvatar) localStorage.setItem("navAvatarUrl", nextAvatar);
        else localStorage.removeItem("navAvatarUrl");
        if (nextName) localStorage.setItem("navDisplayName", nextName);
        else localStorage.removeItem("navDisplayName");
      } catch {}
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Track scroll on whichever ancestor actually scrolls on this page so the
  // shadow appears the moment content starts sliding under the navbar. Most
  // pages scroll the window; PageShell and a few others scroll an inner
  // container — we walk up from the header to find whichever one it is.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let scroller: HTMLElement | Window = window;
    let node: HTMLElement | null = header.parentElement;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }

    const getScrollTop = () =>
      scroller === window
        ? window.scrollY
        : (scroller as HTMLElement).scrollTop;

    const onScroll = () => setScrolled(getScrollTop() > 0);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  const menuLinkClass = "block px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors";

  return (
    <header
      ref={headerRef}
      className={`bg-surface shrink-0 sticky top-0 z-40 transition-shadow duration-[var(--duration-base)] ${
        scrolled ? "shadow-[0_2px_8px_rgba(0,0,0,0.04)]" : ""
      }`}
    >
      <div className="px-4 py-2.5 flex items-center">
        {/* Left: Logo + City */}
        <div className="flex-1 flex items-center gap-5">
          <Link href="/" className="flex items-center gap-1 h-8">
            <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5 nav-logo dark:invert" />
            <span className="text-lg tracking-tight whitespace-nowrap text-neutral-900 dark:text-white nav-title" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
              Standard Spaces
            </span>
          </Link>

        </div>

        {/* Center: Search (desktop) */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden md:flex items-center gap-1.5 h-9 w-[280px] pl-3 pr-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-full bg-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
        >
          <Search size={14} strokeWidth={2} />
          Search
        </button>

        {/* Right: User menu */}
        <div className="flex-1 flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative flex items-center gap-2 h-10 pl-3 pr-1.5 border border-neutral-200 dark:border-neutral-800 rounded-full hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            {(unreadNotifs > 0 || adminPending > 0 || mockJewel) && (
              <span
                className="absolute w-1.5 h-1.5 rounded-full bg-brand-500"
                style={{
                  // Pill button: right cap is a semicircle of r = height/2.
                  // These offsets place the 6px dot's center on that arc at
                  // ~45°, so the surface-color ring reads as a clean cutout
                  // right on the border line.
                  top: "1.5px",
                  right: "1.5px",
                  boxShadow: "0 0 0 2px var(--color-surface)",
                }}
                aria-label="Unread activity"
              />
            )}
            <Menu size={14} strokeWidth={2} className="text-neutral-600 dark:text-neutral-400" />
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={28} height={28} sizes="28px" priority className="w-7 h-7 rounded-full object-cover" />
            ) : avatarUrl === null ? (
              <div
                className="w-7 h-7 rounded-full bg-surface-dark dark:bg-[#F7F7F3] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-[11px] text-[#F7F7F3] dark:text-surface-dark"
                style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
              >
                {getInitials(displayName)}
              </div>
            ) : (
              // Avatar status unknown — render an invisible placeholder of the
              // same dimensions so the menu button doesn't shift when it loads.
              <div className="w-7 h-7 rounded-full" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 overflow-hidden">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Profile
              </Link>
              <div className="border-t border-neutral-200 dark:border-neutral-700" />
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                Notifications
                {(unreadNotifs > 0 || mockJewel) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-label={`${unreadNotifs} unread`} />
                )}
              </Link>
              <Link href="/recommend" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Recommendations
              </Link>
              <Link href="/referrals" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                Referrals
                {pendingReferrals > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-brand-500 text-white rounded-full min-w-[18px] text-center">
                    {pendingReferrals}
                  </span>
                )}
              </Link>
              <Link href="/events" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Events
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                  Admin
                  {adminPending > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-label={`${adminPending} pending`} />
                  )}
                </Link>
              )}
              <div className="border-t border-neutral-200 dark:border-neutral-700" />
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="block w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
