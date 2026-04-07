"use client";

import { useEffect } from "react";

/** Keeps `auto` theme mode in sync with the OS color scheme while the tab is
 *  alive. The initial paint is handled by the inline script in layout.tsx; this
 *  component only listens for changes after hydration. */
export default function ThemeSync() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      // Only auto mode follows the OS — explicit light/dark in localStorage wins.
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") return;
      const dark = mql.matches;
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.backgroundColor = dark ? "#13120A" : "";
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#13120A" : "#F7F7F3");
    };

    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return null;
}
