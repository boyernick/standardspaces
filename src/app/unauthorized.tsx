"use client";

import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-medium mb-3" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
          Members only
        </h1>
        <p className="text-sm text-black/50 mb-6" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
          You need to be logged in to view this page.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-medium text-white bg-brand-900 rounded-full hover:bg-brand-800 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Log in
          </Link>
          <Link
            href="/apply"
            className="px-5 py-2 text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/5 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Apply to join
          </Link>
        </div>
      </div>
    </div>
  );
}
