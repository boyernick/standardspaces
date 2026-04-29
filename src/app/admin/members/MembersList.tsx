"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type Member = {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  instagram: string | null;
  avatar_url: string | null;
  onboarded: boolean | null;
  created_at: string;
};

type RoleFilter = "all" | "member" | "admin";

const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

export default function MembersList({ members }: { members: Member[] }) {
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: members.length,
      member: members.filter((m) => m.role === "member").length,
      admin: members.filter((m) => m.role === "admin").length,
    }),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter !== "all" && m.role !== filter) return false;
      if (!q) return true;
      const haystack = [
        m.first_name,
        m.last_name,
        m.email,
        m.phone,
        m.instagram,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [members, filter, query]);

  return (
    <div>
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 placeholder:text-black/40 dark:placeholder:text-white/40 transition-colors"
          style={fontCalibre}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6" style={fontCalibre}>
        {(["all", "member", "admin"] as RoleFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                : "border-black/15 dark:border-white/15 text-black/60 dark:text-white/60 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/40" style={fontCalibre}>
          No members match.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const displayName =
              [m.first_name, m.last_name].filter(Boolean).join(" ") ||
              m.email?.split("@")[0] ||
              "Unknown";
            const initials =
              ((m.first_name?.[0] || m.email?.[0] || "?").toUpperCase() +
                (m.last_name?.[0] || "").toUpperCase()) || "?";
            const meta = [
              m.phone,
              m.instagram ? `@${m.instagram.replace("@", "")}` : null,
              m.email || null,
            ].filter(Boolean) as string[];
            return (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="flex items-center gap-4 border border-black/10 dark:border-white/10 rounded-xl p-4 hover:border-black/25 dark:hover:border-white/25 transition-colors"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-ink-100 flex items-center justify-center">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-sm font-medium text-black dark:text-white"
                      style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
                    >
                      {initials}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-[15px] font-medium truncate text-black dark:text-white"
                      style={fontCalibre}
                    >
                      {displayName}
                    </p>
                    {m.role === "admin" && (
                      <span
                        className="shrink-0 px-2 py-1 text-[10px] font-semibold rounded-full bg-surface text-neutral-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.14)] dark:shadow-[0_0_10px_rgba(255,255,255,0.18)]"
                        style={fontCalibre}
                      >
                        Admin
                      </span>
                    )}
                    {m.onboarded === false && (
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full border border-black/15 dark:border-white/20 text-black/55 dark:text-white/55 font-medium"
                        style={fontCalibre}
                      >
                        Not onboarded
                      </span>
                    )}
                  </div>
                  {meta.length > 0 && (
                    <p
                      className="text-xs text-black/50 dark:text-white/50 truncate mt-0.5"
                      style={fontCalibre}
                    >
                      {meta.join("  ·  ")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
