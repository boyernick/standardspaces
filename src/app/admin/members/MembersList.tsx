"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone…"
          className="ml-auto min-w-[180px] flex-1 sm:flex-none px-3 py-1.5 text-xs rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 placeholder:text-black/30 dark:placeholder:text-white/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/40" style={fontCalibre}>
          No members match.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const displayName =
              [m.first_name, m.last_name].filter(Boolean).join(" ") ||
              m.email.split("@")[0];
            const initials =
              (m.first_name?.[0] || m.email[0] || "?").toUpperCase() +
              (m.last_name?.[0] || "").toUpperCase();
            return (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="flex items-center gap-4 border border-black/10 dark:border-white/10 rounded-lg p-4 bg-white dark:bg-neutral-900 hover:border-black/20 dark:hover:border-white/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-black/50 dark:text-white/50" style={fontCalibre}>
                      {initials}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate text-black dark:text-white" style={fontCalibre}>
                      {displayName}
                    </p>
                    {m.role === "admin" && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-100"
                        style={fontCalibre}
                      >
                        admin
                      </span>
                    )}
                    {m.onboarded === false && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800"
                        style={fontCalibre}
                      >
                        not onboarded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-black/50 dark:text-white/50 truncate" style={fontCalibre}>
                    {m.email}
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-black/40 dark:text-white/40 mt-0.5"
                    style={fontCalibre}
                  >
                    {m.phone && <span>{m.phone}</span>}
                    {m.instagram && <span>@{m.instagram.replace("@", "")}</span>}
                    <span>
                      Joined{" "}
                      {new Date(m.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
