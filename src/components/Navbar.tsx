"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

const cities = [
  { name: "Miami", slug: "miami" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950" style={{ position: "relative", zIndex: 30 }}>
      <div className="px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left: Logo + City Selector */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="text-lg tracking-tight whitespace-nowrap" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
            Standard Spaces
          </Link>

          {/* City Dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setCityOpen(!cityOpen)}
              className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              {currentCity.name}
              <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${cityOpen ? "rotate-180" : ""}`} />
            </button>

            {cityOpen && (
              <div className="absolute top-full left-0 mt-2 w-44 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg dark:shadow-neutral-900/50 py-1 z-50">
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

        {/* Right: Auth Buttons (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </button>
          <button className="text-sm bg-brand-900 text-white px-4 py-1.5 rounded-full hover:bg-brand-800 transition-colors">
            Sign up
          </button>
        </div>

        {/* Right: Hamburger menu (mobile) */}
        <div ref={menuRef} className="relative md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? (
              <X size={20} strokeWidth={2} />
            ) : (
              <Menu size={20} strokeWidth={2} />
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg dark:shadow-neutral-900/50 py-2 z-50">
              <button
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
