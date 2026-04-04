"use client";

import { useEffect } from "react";

/** Overrides html, body, and theme-color to beige (#E8E0D0) on mount.
 *  Restores original values on unmount.
 *  iOS renders safe areas (status bar, home indicator, overscroll) from
 *  the html/body background — this ensures they match the landing page. */
export default function LandingTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;

    html.style.backgroundColor = "#E8E0D0";
    body.style.backgroundColor = "#E8E0D0";

    // Update all theme-color meta tags
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    const prevThemes = Array.from(metas).map((m) => (m as HTMLMetaElement).content);
    metas.forEach((m) => { (m as HTMLMetaElement).content = "#E8E0D0"; });

    // Add one if none exist
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#E8E0D0";
      document.head.appendChild(meta);
    }

    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
      const currentMetas = document.querySelectorAll('meta[name="theme-color"]');
      currentMetas.forEach((m, i) => {
        if (prevThemes[i]) (m as HTMLMetaElement).content = prevThemes[i];
      });
    };
  }, []);

  return null;
}
