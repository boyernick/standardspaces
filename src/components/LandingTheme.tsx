"use client";

import { useEffect } from "react";

/** Sets the html background to beige on mount, restores on unmount.
 *  This ensures iOS safe areas (status bar, home indicator) match the landing page. */
export default function LandingTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = "#E8E0D0";

    // Also update theme-color meta tag for status bar
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prevTheme = meta?.content;
    if (meta) {
      meta.content = "#E8E0D0";
    } else {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#E8E0D0";
      document.head.appendChild(meta);
    }

    return () => {
      html.style.backgroundColor = prev;
      if (meta && prevTheme) meta.content = prevTheme;
    };
  }, []);

  return null;
}
