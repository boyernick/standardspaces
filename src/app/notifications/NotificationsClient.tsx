"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Bell, Calendar, Compass, MapPin, Sparkles, Star, User, CircleUserRound } from "lucide-react";
import {
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import {
  renderNotification,
  type NotificationRow,
} from "@/lib/notifications-render";
import EmptyState from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/admin/form";

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
      return <Compass size={size} strokeWidth={sw} className={cls} />;
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

type Bucket = "Today" | "This week";
function bucketFor(ts: string): Bucket {
  const delta = Date.now() - new Date(ts).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) return "Today";
  return "This week";
}

type Filter = "all" | "unread";

export default function NotificationsClient({ initialRows, mock = false }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>("all");

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

  const unreadCount = useMemo(() => rows.filter((r) => r.read_at === null).length, [rows]);
  const visibleRows = useMemo(
    () => (filter === "unread" ? rows.filter((r) => r.read_at === null) : rows),
    [rows, filter],
  );

  const grouped = useMemo(() => {
    const out: Record<Bucket, NotificationRow[]> = {
      Today: [],
      "This week": [],
    };
    for (const r of visibleRows) out[bucketFor(r.created_at)].push(r);
    return out;
  }, [visibleRows]);

  const isEmpty = rows.length === 0;
  const isFilteredEmpty = !isEmpty && visibleRows.length === 0;

  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-6">
        <h1 className="mb-0">Notifications</h1>
        {mock && (
          <span className="text-[11px] italic text-neutral-400 dark:text-neutral-500 shrink-0 pb-2">
            Preview mode · add <code className="not-italic">?mock=1</code>
          </span>
        )}
      </div>

      {/* Filter tabs — only rendered when there's something to filter */}
      {!isEmpty && (
        <div className="flex items-center gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
            All
            <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">{rows.length}</span>
          </FilterTab>
          <FilterTab active={filter === "unread"} onClick={() => setFilter("unread")} disabled={unreadCount === 0}>
            Unread
            {unreadCount > 0 && (
              <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">{unreadCount}</span>
            )}
          </FilterTab>
        </div>
      )}

      {isEmpty ? (
        <EmptyState icon={Bell} title="You're all caught up" body="No new notifications right now." />
      ) : isFilteredEmpty ? (
        <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No unread notifications.
        </div>
      ) : (
        (["Today", "This week"] as const).map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          return (
            <section key={bucket} className="mb-10">
              <div className="mb-3">
                <SectionHeader>{bucket}</SectionHeader>
              </div>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {items.map((row) => (
                  <NotificationItem key={row.id} row={row} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

function FilterTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative px-3 py-2 text-sm transition-colors -mb-px ${
        active
          ? "text-neutral-900 dark:text-white font-medium"
          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-neutral-500`}
    >
      {children}
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-px bg-neutral-900 dark:bg-white" />
      )}
    </button>
  );
}

function NotificationItem({ row }: { row: NotificationRow }) {
  const r = renderNotification(row);
  const unread = row.read_at === null;
  return (
    <li>
      <Link
        href={r.href}
        className="group flex items-start gap-3 pl-2 pr-3 py-3 transition-colors hover:bg-ink-100"
      >
        <span
          aria-label={unread ? "Unread" : undefined}
          className={`w-1.5 h-1.5 rounded-full shrink-0 mt-5 ${
            unread ? "bg-brand-500" : "bg-transparent"
          }`}
        />
        {r.actorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.actorAvatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : r.actorName ? (
          <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <CircleUserRound
              size={22}
              strokeWidth={1.5}
              className="text-neutral-500 dark:text-neutral-400"
            />
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
        <div className="shrink-0 pt-0.5">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {relative(row.created_at)}
          </span>
        </div>
      </Link>
    </li>
  );
}
