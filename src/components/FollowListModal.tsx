"use client";

/**
 * Followers / Following list modal for the profile page.
 *
 * Opened by tapping the "N followers" or "N following" counts. Lazy-loads
 * the member list via `getFollowList` on open so we don't ship every
 * profile's social graph in the initial payload (most visitors never
 * expand it). Each row links to `/members/[id]`; closing the modal on
 * click lets the router transition feel instantaneous.
 *
 * Chrome (portal, backdrop, slide-up, Esc-to-close, body scroll lock)
 * mirrors `RatingSheet` so modal styling stays consistent across the app.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { getFollowList, type FollowListMember } from "@/app/actions/follows";
import { getInitials } from "@/lib/initials";

type Kind = "followers" | "following";

export default function FollowListModal({
  userId,
  kind,
  open,
  onClose,
}: {
  userId: string;
  kind: Kind;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<FollowListMember[] | null>(null);

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch once each time the modal is opened. Re-opening after an edit
  // should re-read so follow/unfollow actions from another surface
  // reflect here without a page refresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMembers(null);
    (async () => {
      const list = await getFollowList(userId, kind);
      if (!cancelled) {
        setMembers(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, kind]);

  // Body scroll lock + Esc-to-close, matching RatingSheet's chrome.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const title = kind === "followers" ? "Followers" : "Following";
  const emptyCopy =
    kind === "followers" ? "No followers yet" : "Not following anyone yet";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
      />

      <div className="relative w-full sm:max-w-md bg-surface sm:rounded-2xl rounded-t-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 pb-[max(1rem,env(safe-area-inset-bottom))] animate-[slideUp_220ms_cubic-bezier(0.22,1,0.36,1)] max-h-[80dvh] flex flex-col">
        <div className="relative px-5 pt-5 pb-3 shrink-0">
          <h2
            className="text-center text-base font-semibold text-neutral-900 dark:text-white"
            style={fontCalibre}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} className="text-neutral-600 dark:text-neutral-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading && (
            <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
              Loading…
            </div>
          )}
          {!loading && members && members.length === 0 && (
            <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
              {emptyCopy}
            </div>
          )}
          {!loading && members && members.length > 0 && (
            <ul>
              {members.map((m) => {
                const name =
                  [m.first_name, m.last_name].filter(Boolean).join(" ") ||
                  "Member";
                return (
                  <li key={m.id}>
                    <Link
                      href={`/members/${m.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full bg-surface-dark dark:bg-[#F7F7F3] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shrink-0 text-sm text-[#F7F7F3] dark:text-surface-dark"
                          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
                        >
                          {getInitials(name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium text-neutral-900 dark:text-white truncate"
                          style={fontCalibre}
                        >
                          {name}
                        </p>
                        {m.city && (
                          <p
                            className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5"
                            style={fontCalibre}
                          >
                            {m.city}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
