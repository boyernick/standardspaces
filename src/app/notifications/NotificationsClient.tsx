"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Bell, Calendar, Compass, MapPin, Sparkles, Star, User } from "lucide-react";
import { getInitials } from "@/lib/initials";
import {
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import {
  renderNotification,
  type NotificationRow,
} from "@/lib/notifications-render";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";

interface Props {
  initialRows: NotificationRow[];
  mock?: boolean;
}

function IconFor({ kind }: { kind: "user" | "calendar" | "pin" | "star" | "bell" | "sparkles" | "award" | "compass" }) {
  const cls = "text-neutral-500";
  const size = 14;
  const sw = 1.75;
  switch (kind) {
    case "user":
      return <User size={size} strokeWidth={sw} className={cls} />;
    case "calendar":
      return <Calendar size={size} strokeWidth={sw} className={cls} />;
    case "pin":
      return <MapPin size={size} strokeWidth={sw} className={cls} />;
    case "star":
      return <Star size={size} strokeWidth={sw} className={cls} />;
    case "sparkles":
      return <Sparkles size={size} strokeWidth={sw} className={cls} />;
    case "award":
      return <Award size={size} strokeWidth={sw} className={cls} />;
    case "compass":
      return <MapPin size={size} strokeWidth={sw} className="text-white" />;
    case "bell":
    default:
      return <Bell size={size} strokeWidth={sw} className={cls} />;
  }
}

function relative(ts: string): string {
  const delta = Date.now() - new Date(ts).getTime();
  const s = Math.round(delta / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Bucket = "today" | "week" | "month";
function bucketFor(ts: string): Bucket {
  const delta = Date.now() - new Date(ts).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) return "today";
  if (delta < 7 * day) return "week";
  return "month";
}

export default function NotificationsClient({ initialRows, mock = false }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<Bucket>("today");

  // Snapshot of which rows were unread when the page loaded. We auto-mark
  // everything as read on mount, so the row's own read_at stops being a
  // reliable signal. This set lets the UI keep showing "new since last visit"
  // — the orange jewel on each row — even after the server mark-as-read lands.
  const [unreadOnMount] = useState<Set<string>>(
    () => new Set(initialRows.filter((r) => r.read_at === null).map((r) => r.id)),
  );

  // Auto-mark as read on mount. Optimistic: clear locally first, then call
  // the server. Navbar badge uses its own cached value and will update on
  // next mount. Skipped entirely in mock mode so the fixture keeps its
  // unread/read mix visible on every reload.
  useEffect(() => {
    // Keep the Navbar mock jewel in sync with whether we're viewing the
    // seeded preview. Set on entry to `?mock=1`, cleared on any real visit.
    try {
      if (mock) localStorage.setItem("navMockJewel", "1");
      else localStorage.removeItem("navMockJewel");
    } catch {}

    if (mock) return;
    if (rows.some((r) => r.read_at === null)) {
      const now = new Date().toISOString();
      setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? now })));
      markAllNotificationsRead().catch(() => {});
      try {
        localStorage.setItem("navUnreadCount", "0");
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const out: Record<Bucket, NotificationRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    for (const r of rows) out[bucketFor(r.created_at)].push(r);
    return out;
  }, [rows]);

  const isEmpty = rows.length === 0;
  const active = grouped[tab];

  const tabs: { id: Bucket; label: string; count: number }[] = [
    { id: "today", label: "Today", count: grouped.today.length },
    { id: "week", label: "This week", count: grouped.week.length },
    { id: "month", label: "This month", count: grouped.month.length },
  ];

  const emptyByTab: Record<Bucket, { title: string; body: string }> = {
    today: {
      title: "Nothing new today",
      body: "When something happens, you'll see it here.",
    },
    week: {
      title: "Nothing this week",
      body: "Activity from the last seven days shows up here.",
    },
    month: {
      title: "Nothing older",
      body: "Older activity will live here.",
    },
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        action={
          mock ? (
            <span className="text-[11px] italic text-neutral-400 dark:text-neutral-500 shrink-0">
              Preview mode · add <code className="not-italic">?mock=1</code>
            </span>
          ) : undefined
        }
      />

      {isEmpty ? (
        <EmptyState icon={Bell} title="You're all caught up" body="No new notifications right now." />
      ) : (
        <>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {active.length === 0 ? (
            <EmptyState icon={Bell} title={emptyByTab[tab].title} body={emptyByTab[tab].body} />
          ) : (
            <ul>
              {active.map((row) => (
                <NotificationItem key={row.id} row={row} unread={unreadOnMount.has(row.id)} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function NotificationItem({ row, unread }: { row: NotificationRow; unread: boolean }) {
  const r = renderNotification(row);
  return (
    <li>
      <Link
        href={r.href}
        className="group relative flex items-start gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-ink-100/40 dark:hover:bg-neutral-100/[0.04]"
      >
        {r.coverImage ? (
          // Notifications about a specific space or event lead with its own
          // hero/cover image in a rounded-square tile — more recognizable
          // than a generic icon, distinct from the circular person avatar.
          // Sized larger than the avatar / icon variants (48 vs 40) so the
          // photo has room to read; `rounded-lg` is a deliberate step softer
          // than the actor avatar's full circle without going too boxy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.coverImage}
            alt=""
            className="w-12 h-12 rounded-lg object-cover shrink-0 bg-ink-100 dark:bg-neutral-800 border border-neutral-400 dark:border-neutral-500"
          />
        ) : r.actorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.actorAvatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : r.actorName ? (
          <div
            className="w-10 h-10 rounded-full bg-surface-dark dark:bg-[#F7F7F3] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shrink-0 text-sm text-[#F7F7F3] dark:text-surface-dark"
            style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
          >
            {getInitials(r.actorName)}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <IconFor kind={r.icon} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm line-clamp-2 ${
              unread
                ? "text-neutral-900 dark:text-white font-medium"
                : "text-neutral-700 dark:text-neutral-200"
            }`}
          >
            {r.title}
          </p>
          {r.body && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
              {r.body}
            </p>
          )}
        </div>
        <div className="shrink-0 pt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {relative(row.created_at)}
          </span>
          <span
            aria-label={unread ? "Unread" : undefined}
            className={`w-1.5 h-1.5 rounded-full ${unread ? "bg-brand-500" : "bg-transparent"}`}
          />
        </div>
      </Link>
    </li>
  );
}
