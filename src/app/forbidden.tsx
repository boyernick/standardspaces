"use client";

import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-medium mb-3" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
          Access denied
        </h1>
        <p className="text-sm text-black/50 mb-6" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
          You don&apos;t have permission to view this page.
        </p>
        <Link
          href="/miami"
          className="px-5 py-2 text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/5 transition-colors"
          style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
        >
          Back to guide
        </Link>
      </div>
    </div>
  );
}
