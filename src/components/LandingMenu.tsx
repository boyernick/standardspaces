"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

export default function LandingMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-10 h-10 border border-black/20 rounded-full hover:bg-black/5 transition-colors"
      >
        <Menu size={16} strokeWidth={2} className="text-black/70" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-44 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50 animate-[fadeSlideDown_150ms_ease-out]">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Sign in
          </Link>
          <Link
            href="/apply"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Apply to join
          </Link>
        </div>
      )}
    </div>
  );
}
