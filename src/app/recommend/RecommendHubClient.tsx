"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Globe } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import type { MyRecommendation } from "@/app/actions/recommendations";

type Tab = "pending" | "approved" | "denied";

/**
 * Member-facing recommendations hub. Tabs bucket the user's own submissions
 * by visible outcome:
 *   - Pending: any status that isn't `published` or `denied` (covers
 *     `pending`, `processing`, `scraped`, `failed` — all "not yet live").
 *   - Approved: status = `published` (live in the guide).
 *   - Denied: status = `denied` (no admin flow emits this today, so the
 *     tab renders empty until we add one — keeps the shape future-safe).
 */
function bucketFor(status: string): Tab {
  if (status === "published") return "approved";
  if (status === "denied") return "denied";
  return "pending";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function RecommendHubClient({
  recommendations,
}: {
  recommendations: MyRecommendation[];
}) {
  const [tab, setTab] = useState<Tab>("pending");

  const grouped = useMemo(() => {
    const out: Record<Tab, MyRecommendation[]> = {
      pending: [],
      approved: [],
      denied: [],
    };
    for (const r of recommendations) out[bucketFor(r.status)].push(r);
    return out;
  }, [recommendations]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: grouped.pending.length },
    { id: "approved", label: "Approved", count: grouped.approved.length },
    { id: "denied", label: "Denied", count: grouped.denied.length },
  ];

  const active = grouped[tab];
  const empty =
    tab === "pending"
      ? {
          title: "No pending recommendations",
          body: "Spaces you submit will show up here while we review them.",
        }
      : tab === "approved"
        ? {
            title: "No approved recommendations yet",
            body: "When one of your submissions is added to the guide, it'll live here.",
          }
        : {
            title: "No denied recommendations",
            body: "Recommendations we couldn't add will show up here with a note.",
          };

  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {active.length === 0 ? (
        <EmptyState icon={Compass} title={empty.title} body={empty.body} />
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <RecommendationRow key={r.id} rec={r} />
          ))}
        </ul>
      )}
    </>
  );
}

function RecommendationRow({ rec }: { rec: MyRecommendation }) {
  // Prefer the admin-set `name`; fall back to whatever the scraper extracted;
  // last resort is the bare host so the row never reads as empty.
  const scrapedName =
    rec.scraped_data && typeof rec.scraped_data === "object" && "name" in rec.scraped_data
      ? (rec.scraped_data as { name?: unknown }).name
      : null;
  const displayName =
    rec.name || (typeof scrapedName === "string" && scrapedName.trim()) || hostOf(rec.url);

  const secondary: string[] = [];
  if (rec.neighborhood) secondary.push(rec.neighborhood);
  if (rec.category) secondary.push(rec.category);

  return (
    <li>
      <div className="flex items-center justify-between gap-3 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate flex items-center gap-1.5">
            <Globe size={12} strokeWidth={1.5} className="shrink-0" />
            <Link
              href={rec.url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors truncate"
            >
              {hostOf(rec.url)}
            </Link>
            {secondary.length > 0 && (
              <span className="text-neutral-400 dark:text-neutral-500">
                · {secondary.join(" · ")}
              </span>
            )}
          </p>
        </div>
        <span
          className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 tabular-nums"
          title={new Date(rec.created_at).toLocaleString()}
        >
          {formatDate(rec.created_at)}
        </span>
      </div>
    </li>
  );
}

