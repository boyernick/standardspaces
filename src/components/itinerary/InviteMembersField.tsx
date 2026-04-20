"use client";

// Autocomplete + chip list for inviting members to a plan. Extracted from
// NewEventClient so the saved-plan editor and any future invite surface can
// reuse the pattern. The component is purely presentational — it owns the
// search query state and the typeahead results, but the list of invited
// members (and the diff vs. what's already saved) is owned by the parent.
//
// The search action is injected so this component stays feature-agnostic:
// callers wire it to `searchMembersForItineraryInvite` /
// `searchMembersForInvite` / whichever. Keeps one copy of the autocomplete
// UX in the codebase.

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { MemberSearchResult } from "@/app/actions/events";

interface Props {
  invitees: MemberSearchResult[];
  onChange: (next: MemberSearchResult[]) => void;
  /** Caller-injected search. Should return up to N matches, excluding
   *  the caller. Empty query returns []. */
  search: (q: string) => Promise<MemberSearchResult[]>;
  placeholder?: string;
}

export default function InviteMembersField({
  invitees,
  onChange,
  search,
  placeholder = "Search for members",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // 200ms debounce mirrors the events form — fast enough to feel live,
  // slow enough that single-char bursts don't queue up backend calls.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await search(query);
      setResults(res);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, search]);

  function add(m: MemberSearchResult) {
    if (invitees.some((i) => i.id === m.id)) return;
    onChange([...invitees, m]);
    setQuery("");
    setResults([]);
  }

  function remove(id: string) {
    onChange(invitees.filter((m) => m.id !== id));
  }

  const visible = results.filter((m) => !invitees.some((i) => i.id === m.id));

  return (
    <div>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
        />
        {query && (visible.length > 0 || searching) && (
          <div className="absolute z-10 left-0 right-0 mt-1.5 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {searching && visible.length === 0 && (
              <div className="px-4 py-2 text-xs text-neutral-500">Searching…</div>
            )}
            {visible.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => add(m)}
                className="w-full flex items-center gap-3 text-left px-4 py-2 hover:bg-ink-100 transition-colors"
              >
                <Avatar member={m} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {memberLabel(m)}
                  </div>
                  {m.instagram && (
                    <div className="text-xs text-neutral-500 truncate">
                      @{m.instagram}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {invitees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {invitees.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-surface text-xs text-neutral-700 dark:text-neutral-200"
            >
              <Avatar member={m} size={20} />
              {memberLabel(m)}
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="text-neutral-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${memberLabel(m)}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function memberLabel(m: MemberSearchResult): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return full || m.instagram || "Member";
}

function Avatar({
  member,
  size = 28,
}: {
  member: MemberSearchResult;
  size?: number;
}) {
  const initial = (
    member.first_name?.[0] ||
    member.instagram?.[0] ||
    "?"
  ).toUpperCase();
  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-300 shrink-0"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}
