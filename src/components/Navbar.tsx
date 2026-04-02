"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, X, Search, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const cities = [
  { name: "Miami", slug: "miami" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">("auto");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setThemeMode(stored);
    } else {
      setThemeMode("auto");
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email });
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.role === "admin") setIsAdmin(true);
          });
      }
    });
  }, []);

  const currentCity =
    cities.find((c) => pathname.startsWith(`/${c.slug}`)) ?? cities[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-surface shrink-0" style={{ position: "relative", zIndex: 40 }}>
      <div className="px-4 py-2.5 flex items-center">
        {/* Left: Logo + City */}
        <div className="flex-1 flex items-center gap-5">
          <Link href="/miami" className="flex items-center gap-1">
            <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5 nav-logo dark:invert" />
            <span className="text-lg tracking-tight whitespace-nowrap text-neutral-900 dark:text-white nav-title" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
              Standard Spaces
            </span>
          </Link>


          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setCityOpen(!cityOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-full border border-transparent hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              {currentCity.name}
              <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${cityOpen ? "rotate-180" : ""}`} />
            </button>

            {cityOpen && (
              <div className="absolute top-full left-0 mt-2 w-44 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-50">
                {cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${city.slug}`}
                    onClick={() => setCityOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      currentCity.slug === city.slug
                        ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {city.name}
                  </Link>
                ))}
                <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                  <span className="block px-4 py-2 text-xs text-neutral-300 dark:text-neutral-600">
                    More cities coming soon
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search (desktop) */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden md:flex items-center justify-between w-[280px] pl-3 pr-2.5 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-full bg-transparent text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Search size={13} strokeWidth={2} />
            Search for spaces
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
            className="flex items-center gap-2 pl-3 pr-1.5 py-1 border border-neutral-200 dark:border-neutral-800 rounded-full hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            <Menu size={14} strokeWidth={2} className="text-neutral-600 dark:text-neutral-400" />
            <div className="w-7 h-7 rounded-full bg-brand-900" />
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                Profile
              </Link>
              <Link href="/recommend" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                Recommend a space
              </Link>
              <button
                onClick={() => {
                  let nextMode: "auto" | "light" | "dark";
                  if (themeMode === "auto") nextMode = "light";
                  else if (themeMode === "light") nextMode = "dark";
                  else nextMode = "auto";

                  setThemeMode(nextMode);

                  if (nextMode === "auto") {
                    localStorage.removeItem("theme");
                    const hour = new Date().getHours();
                    const shouldBeDark = hour >= 19 || hour < 7;
                    document.documentElement.classList.toggle("dark", shouldBeDark);
                    setIsDark(shouldBeDark);
                  } else {
                    localStorage.setItem("theme", nextMode);
                    document.documentElement.classList.toggle("dark", nextMode === "dark");
                    setIsDark(nextMode === "dark");
                  }
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                {themeMode === "auto" ? "Auto mode" : themeMode === "light" ? "Light mode" : "Dark mode"}
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {themeMode === "auto" ? "auto" : ""}
                </span>
              </button>
              {isAdmin && (
                <Link href="/admin/listings" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                  Admin
                </Link>
              )}
              <div className="border-t border-neutral-100 dark:border-neutral-800 my-0.5" />
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/");
                }}
                className="block w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
