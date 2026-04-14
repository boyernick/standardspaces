"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Calendar, MapPin, Sparkles, Star, User, CircleUserRound } from "lucide-react";
import {
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import {
  renderNotification,
  type NotificationRow,
} from "@/lib/notifications-render";

interface Props {
  initialRows: NotificationRow[];
  mock?: boolean;
}

function IconFor({ kind }: { kind: "user" | "calendar" | "pin" | "star" | "bell" | "sparkles" }) {
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

type Bucket = "Today" | "This week" | "Earlier";
function bucketFor(ts: string): Bucket {
  const delta = Date.now() - new Date(ts).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) return "Today";
  if (delta < 7 * day) return "This week";
  return "Earlier";
}

export default function NotificationsClient({ initialRows, mock = false }: Props) {
  const [rows, setRows] = useState(initialRows);

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
      Today: [],
      "This week": [],
      Earlier: [],
    };
    for (const r of rows) out[bucketFor(r.created_at)].push(r);
    return out;
  }, [rows]);

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  const isEmpty = rows.length === 0;

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-xl font-medium mb-8" style={fontMartina}>
        Notifications
      </h1>

      {mock && (
        <div
          className="mb-6 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg"
          style={fontCalibre}
        >
          Preview mode — showing seeded mock notifications. Remove{" "}
          <code className="text-neutral-700 dark:text-neutral-300">?mock=1</code> from the URL to
          see real ones.
        </div>
      )}

      {isEmpty ? (
        <div className="px-6 py-20 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#eceae2] dark:bg-[#0e0d07]">
            <Bell size={20} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
          </div>
          <h3 className="text-base font-medium">You&apos;re all caught up</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto" style={fontCalibre}>
            No new notifications right now.
          </p>
        </div>
      ) : (
        (["Today", "This week", "Earlier"] as const).map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          return (
            <section key={bucket} className="mb-8">
              <h2
                className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3"
                style={fontCalibre}
              >
                {bucket}
              </h2>
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-200 dark:divide-neutral-800">
                {items.map((row) => {
                  const r = renderNotification(row);
                  const unread = row.read_at === null;
                  return (
                    <Link
                      key={row.id}
                      href={r.href}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                        unread ? "bg-neutral-50/60 dark:bg-neutral-900/40" : ""
                      }`}
                    >
                      {r.actorAvatar ? (
                        <img
                          src={r.actorAvatar}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : r.actorName ? (
                        <div className="w-9 h-9 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center shrink-0">
                          <CircleUserRound
                            size={20}
                            strokeWidth={1.5}
                            className="text-white dark:text-neutral-900"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                          <IconFor kind={r.icon} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm text-neutral-900 dark:text-white line-clamp-2"
                          style={fontCalibre}
                        >
                          {r.title}
                        </p>
                        {r.body && (
                          <p
                            className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1"
                            style={fontCalibre}
                          >
                            {r.body}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span
                          className="text-[11px] text-neutral-400 dark:text-neutral-500"
                          style={fontCalibre}
                        >
                          {relative(row.created_at)}
                        </span>
                        {unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
