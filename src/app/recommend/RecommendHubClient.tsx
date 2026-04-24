"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Compass, Globe } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  deleteRecommendation,
  type MyRecommendation,
} from "@/app/actions/recommendations";

type Tab = "pending" | "approved";

/**
 * Member-facing recommendations hub. Tabs bucket the user's own submissions
 * by visible outcome:
 *   - Pending: anything not yet live (`pending`, `processing`, `scraped`,
 *     `failed`, `denied`). We deliberately collapse "denied" into
 *     "pending" for the member view today — there's no admin flow that
 *     emits `denied`, and we'd rather not surface a "Denied" tab that
 *     exists only to shame rejections. Revisit when we build an explicit
 *     "not accepted" flow with reason copy.
 *   - Approved: status = `published` (live in the guide).
 */
function bucketFor(status: string): Tab {
  if (status === "published") return "approved";
  return "pending";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function RecommendHubClient({
  recommendations,
}: {
  recommendations: MyRecommendation[];
}) {
  const [tab, setTab] = useState<Tab>("pending");
  // Locally drop deleted rows so the UI updates instantly; the server
  // action revalidates /recommend to keep the source of truth aligned.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleRecommendations = useMemo(
    () => recommendations.filter((r) => !deletedIds.has(r.id)),
    [recommendations, deletedIds],
  );

  const grouped = useMemo(() => {
    const out: Record<Tab, MyRecommendation[]> = {
      pending: [],
      approved: [],
    };
    for (const r of visibleRecommendations) out[bucketFor(r.status)].push(r);
    return out;
  }, [visibleRecommendations]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: grouped.pending.length },
    { id: "approved", label: "Approved", count: grouped.approved.length },
  ];

  const active = grouped[tab];
  const empty =
    tab === "pending"
      ? {
          title: "No pending recommendations",
          body: "Spaces you submit will show up here while we review them.",
        }
      : {
          title: "No approved recommendations yet",
          body: "When one of your submissions is added to the guide, it'll live here.",
        };

  const markDeleted = (id: string) =>
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {active.length === 0 ? (
        <EmptyState icon={Compass} title={empty.title} body={empty.body} />
      ) : (
        <ul className="space-y-2">
          {active.map((r, i) => (
            <RecommendationRow
              key={r.id}
              rec={r}
              index={i}
              onDeleted={() => markDeleted(r.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function RecommendationRow({
  rec,
  index,
  onDeleted,
}: {
  rec: MyRecommendation;
  index: number;
  onDeleted: () => void;
}) {
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

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Only pending-bucket rows are deletable; published ones are tied to
  // a live spot and the server action also rejects them defensively.
  const canDelete = rec.status !== "published";

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteRecommendation(rec.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDeleted();
    });
  };

  return (
    <li
      className="list-item-in"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
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
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
        {canDelete ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        ) : rec.spotId && rec.citySlug ? (
          <ButtonLink
            href={`/${rec.citySlug}/${rec.spotId}`}
            variant="secondary"
            size="sm"
            className="shrink-0"
          >
            View space
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}

