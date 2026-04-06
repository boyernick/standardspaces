"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Users, Lock, X, Search } from "lucide-react";
import { EventRecord, EventRsvp, Spot } from "@/lib/types";
import {
  rsvpEvent,
  cancelRsvp,
  cancelEvent,
  searchMembersForInvite,
  inviteMembers,
  removeInvite,
  type MemberSearchResult,
} from "@/app/actions/events";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  instagram?: string | null;
}

interface Attendee extends Profile {
  status: "going" | "waitlist" | "cancelled";
}

interface Props {
  event: EventRecord;
  spot: Spot | null;
  host: Profile | null;
  attendees: Attendee[];
  goingCount: number;
  myRsvp: EventRsvp | null;
  isHost: boolean;
  invitedUserIds: string[];
  invitees: Profile[];
  viewerId: string | null;
}

function fullName(p: Profile | null): string {
  if (!p) return "Unknown";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) {
    return `${s.toLocaleDateString("en-US", dateOpts)} · ${s.toLocaleTimeString("en-US", timeOpts)} – ${e.toLocaleTimeString("en-US", timeOpts)}`;
  }
  return `${s.toLocaleDateString("en-US", dateOpts)} ${s.toLocaleTimeString("en-US", timeOpts)} – ${e.toLocaleDateString("en-US", dateOpts)} ${e.toLocaleTimeString("en-US", timeOpts)}`;
}

export default function EventClient({
  event,
  spot,
  host,
  attendees,
  goingCount,
  myRsvp,
  isHost,
  invitedUserIds,
  invitees,
  viewerId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Invite picker state (private events, host only)
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<MemberSearchResult[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [invitePending, startInviteTransition] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const showInviteUI = isHost && event.visibility === "private" && event.status !== "cancelled";

  useEffect(() => {
    if (!showInviteUI) return;
    const q = inviteQuery.trim();
    if (!q) {
      setInviteResults([]);
      return;
    }
    setInviteSearching(true);
    const t = setTimeout(async () => {
      const results = await searchMembersForInvite(event.id, q);
      const filtered = results.filter((r) => !invitedUserIds.includes(r.id));
      setInviteResults(filtered);
      setInviteSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [inviteQuery, invitedUserIds, event.id, showInviteUI]);

  function handleInvite(userId: string) {
    setInviteError(null);
    startInviteTransition(async () => {
      const res = await inviteMembers(event.id, [userId]);
      if (!res.ok) {
        setInviteError(res.error);
        return;
      }
      setInviteQuery("");
      setInviteResults([]);
      router.refresh();
    });
  }

  function handleRemoveInvite(userId: string) {
    setInviteError(null);
    startInviteTransition(async () => {
      const res = await removeInvite(event.id, userId);
      if (!res.ok) {
        setInviteError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const isCancelled = event.status === "cancelled";
  const isHidden = event.status === "hidden";
  const isPaid = event.price_cents > 0;
  const isFull = event.capacity != null && goingCount >= event.capacity;

  const goingAttendees = attendees.filter((a) => a.status === "going");
  const waitlistAttendees = attendees.filter((a) => a.status === "waitlist");

  function handleRsvp() {
    setError(null);
    startTransition(async () => {
      const res = await rsvpEvent(event.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleCancelRsvp() {
    setError(null);
    startTransition(async () => {
      const res = await cancelRsvp(event.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleCancelEvent() {
    if (!confirm("Cancel this event? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelEvent(event.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      {/* Cover */}
      {event.cover_image_url && (
        <div className="rounded-2xl overflow-hidden mb-6 aspect-[16/9] bg-neutral-100 dark:bg-neutral-900">
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {event.visibility === "private" && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
            <Lock size={11} /> Private
          </span>
        )}
        {isCancelled && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Cancelled
          </span>
        )}
        {isHidden && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500">
            Hidden by admin
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-[28px] font-semibold tracking-tight mb-3">{event.title}</h1>

      {/* Date + location */}
      <div className="space-y-2 mb-5 text-sm text-neutral-600 dark:text-neutral-400">
        <div>{formatDateRange(event.starts_at, event.ends_at)}</div>
        {spot && (
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <Link href={`/${spot.city}/${spot.id}`} className="hover:underline">
              {spot.name} · {spot.address}
            </Link>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users size={14} />
          {goingCount} going{event.capacity != null ? ` · capacity ${event.capacity}` : ""}
        </div>
      </div>

      {/* Host */}
      {host && (
        <Link
          href={`/members/${host.id}`}
          className="inline-flex items-center gap-2 mb-6 text-sm hover:underline"
        >
          {host.avatar_url ? (
            <img src={host.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          )}
          <span className="text-neutral-500 dark:text-neutral-400">Hosted by</span>
          <span className="font-medium">{fullName(host)}</span>
        </Link>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap mb-6">
          {event.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {!isCancelled && !isHidden && viewerId && !isHost && (
          <>
            {myRsvp && myRsvp.status !== "cancelled" ? (
              <button
                onClick={handleCancelRsvp}
                disabled={pending}
                className="px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 disabled:opacity-50"
              >
                {myRsvp.status === "going" ? "Going — Cancel RSVP" : "On waitlist — Leave"}
              </button>
            ) : isPaid ? (
              <button
                disabled
                className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 opacity-50"
                title="Paid checkout coming soon"
              >
                Buy ticket — ${(event.price_cents / 100).toFixed(2)}
              </button>
            ) : (
              <button
                onClick={handleRsvp}
                disabled={pending}
                className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-50"
              >
                {isFull ? "Join waitlist" : "RSVP"}
              </button>
            )}
          </>
        )}

        <a
          href={`/api/events/${event.id}/ics`}
          download
          className="px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400"
        >
          Add to calendar
        </a>

        {isHost && !isCancelled && (
          <>
            <Link
              href={`/events/${event.id}/edit`}
              className="px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400"
            >
              Edit
            </Link>
            <button
              onClick={handleCancelEvent}
              disabled={pending}
              className="px-4 py-2 rounded-full text-sm font-medium text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              Cancel event
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Attendees */}
      {goingAttendees.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Going · {goingAttendees.length}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {goingAttendees.map((a) => (
              <Link
                key={a.id}
                href={`/members/${a.id}`}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                )}
                <span className="text-sm truncate">{fullName(a)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showInviteUI && (
        <div className="mb-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <h2 className="text-sm font-semibold mb-1">Invite members</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            Only invited members can see this private event.
          </p>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name or @instagram…"
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
            />
            {inviteQuery && (inviteResults.length > 0 || inviteSearching) && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {inviteSearching && inviteResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
                )}
                {inviteResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={invitePending}
                    onClick={() => handleInvite(m.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-50"
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {[m.first_name, m.last_name].filter(Boolean).join(" ") || "Member"}
                      </div>
                      {m.instagram && (
                        <div className="text-xs text-neutral-500 truncate">@{m.instagram.replace(/^@/, "")}</div>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 shrink-0">Invite</span>
                  </button>
                ))}
                {!inviteSearching && inviteResults.length === 0 && inviteQuery && (
                  <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
                )}
              </div>
            )}
          </div>

          {inviteError && (
            <div className="mb-3 text-xs text-red-600 dark:text-red-400">{inviteError}</div>
          )}

          {invitees.length > 0 ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-2">
                Invited · {invitees.length}
              </div>
              <div className="flex flex-wrap gap-2">
                {invitees.map((m) => (
                  <div
                    key={m.id}
                    className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-neutral-200 dark:border-neutral-800"
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    )}
                    <span className="text-xs">{fullName(m)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInvite(m.id)}
                      disabled={invitePending}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-50"
                      aria-label={`Remove ${fullName(m)}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">No one invited yet.</p>
          )}
        </div>
      )}

      {waitlistAttendees.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3 text-neutral-500">Waitlist · {waitlistAttendees.length}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {waitlistAttendees.map((a) => (
              <div key={a.id} className="flex items-center gap-2 p-2">
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover opacity-60" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 opacity-60" />
                )}
                <span className="text-sm truncate text-neutral-500">{fullName(a)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
