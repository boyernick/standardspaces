"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Lightweight shell that defers mounting the real CommandMenu until the user
 * first invokes it. Every authenticated page includes the root layout, and
 * the real CommandMenu pulls in a Supabase client + the full search UI +
 * semantic-search plumbing — 700+ lines of client code that most mobile
 * users never hit. This gate costs one `useEffect` + one keydown listener
 * and swaps in the real thing the moment ⌘K (or a dispatched synthetic
 * KeyboardEvent from the Search buttons) fires.
 *
 * Once mounted, the gate unregisters its listener and CommandMenu's own
 * internal listener takes over — so subsequent invocations are handled by
 * the real component with no double-handling.
 */

const CommandMenu = dynamic(() => import("./CommandMenu"), { ssr: false });

export default function CommandMenuGate() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMounted(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  if (!mounted) return null;
  return <CommandMenu initialOpen />;
}
