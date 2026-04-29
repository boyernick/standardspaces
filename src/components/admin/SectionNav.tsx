"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/recommendations", label: "Recommendations" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/members", label: "Members" },
];

/**
 * Cross-section nav for admin. Underline-tab visual matches the
 * shared `Tabs` primitive — deliberately distinct from the pill-style
 * filters used inside each list, so the two rows don't read as
 * competing tab strips.
 */
export default function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-4 px-4 mb-6 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 w-max mx-auto">
        {SECTIONS.map(({ href, label }) => {
          const isActive =
            href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative px-4 py-3 text-sm transition-colors duration-[var(--duration-fast)] whitespace-nowrap ${
                isActive
                  ? "text-neutral-900 dark:text-white font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              {label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-neutral-900 dark:bg-white" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
