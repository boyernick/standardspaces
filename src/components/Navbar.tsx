"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Search, CircleUserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPendingReferralCount } from "@/app/actions/referrals";
import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { getAdminPendingCount } from "@/app/actions/admin";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const citySlug = pathname.split("/")[1] || "miami";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  // Combined count of pending applications + unpublished recommendations.
  // Admins only — non-admins always see 0.
  const [adminPending, setAdminPending] = useState(0);
  // Forced on by `/notifications?mock=1` so the preview can show the jewel
  // state on the profile button without writing to the real db.
  const [mockJewel, setMockJewel] = useState(false);
  // Tri-state: undefined = unknown (don't render anything yet), null = signed
  // out / no avatar (render default icon), string = avatar URL.
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // Hydrate avatar from localStorage immediately so repeat visits skip the
    // network round trip and don't flash the default icon.
    try {
      const cached = localStorage.getItem("navAvatarUrl");
      if (cached) setAvatarUrl(cached);
      const cachedUnread = localStorage.getItem("navUnreadCount");
      if (cachedUnread) setUnreadNotifs(parseInt(cachedUnread, 10) || 0);
      const cachedAdminPending = localStorage.getItem("navAdminPending");
      if (cachedAdminPending) setAdminPending(parseInt(cachedAdminPending, 10) || 0);
      if (localStorage.getItem("navMockJewel") === "1") setMockJewel(true);
    } catch {}

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
        try { localStorage.removeItem("navAvatarUrl"); } catch {}
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role, avatar_url")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (data?.role === "admin") setIsAdmin(true);
      const nextAvatar = data?.avatar_url ?? null;
      setAvatarUrl(nextAvatar);
      try {
        if (nextAvatar) localStorage.setItem("navAvatarUrl", nextAvatar);
        else localStorage.removeItem("navAvatarUrl");
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

  const menuLinkClass = "block px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors";

  return (
    <header className="bg-surface shrink-0" style={{ position: "relative", zIndex: 40 }}>
      <div className="px-4 py-2.5 flex items-center">
        {/* Left: Logo + City */}
        <div className="flex-1 flex items-center gap-5">
          <Link href="/" className="flex items-center gap-1">
            <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5 nav-logo dark:invert" />
            <span className="text-lg tracking-tight whitespace-nowrap text-neutral-900 dark:text-white nav-title" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
              Standard Spaces
            </span>
          </Link>

        </div>

        {/* Center: Search (desktop) */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden md:flex items-center justify-between w-[280px] pl-3 pr-2.5 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-full bg-transparent text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Search size={13} strokeWidth={2} />
            Search
          </span>
          <kbd className="text-[10px] text-neutral-300 dark:text-neutral-600 border border-neutral-200 dark:border-neutral-800 rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        {/* Right: User menu */}
        <div className="flex-1 flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative flex items-center gap-2 pl-3 pr-1.5 py-1 border border-neutral-200 dark:border-neutral-800 rounded-full hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
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
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : avatarUrl === null ? (
              <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
                <CircleUserRound size={16} strokeWidth={1.5} className="text-white dark:text-neutral-900" />
              </div>
            ) : (
              // Avatar status unknown — render an invisible placeholder of the
              // same dimensions so the menu button doesn't shift when it loads.
              <div className="w-7 h-7 rounded-full" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50 overflow-hidden">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Profile
              </Link>
              <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
              <Link href="/events" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Events
              </Link>
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                Notifications
                {(unreadNotifs > 0 || mockJewel) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-label={`${unreadNotifs} unread`} />
                )}
              </Link>
              <Link href="/recommend" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Recommendations
              </Link>
              <Link href="/referrals" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                Referrals
                {pendingReferrals > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-brand-500 text-white rounded-full min-w-[18px] text-center">
                    {pendingReferrals}
                  </span>
                )}
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors">
                  Admin
                  {adminPending > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-label={`${adminPending} pending`} />
                  )}
                </Link>
              )}
              <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
              <Link href="/settings" onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                Settings
              </Link>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="block w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
