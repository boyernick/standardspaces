"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { humanizeRole } from "@/lib/shot-lists";

// Admin-facing curation modal. Runs /api/admin/curate-photos, shows every
// scored candidate in a grid with role + composite + reasoning, pre-checks
// the selector's picks, lets the admin toggle, and calls `onReplace` with
// the final URL list. Nothing is persisted server-side here — that happens
// inside the route's provenance write. The admin's picks stay in
// PhotoManager state until the outer form hits Publish.

interface Candidate {
  url: string;
  source: "places" | "scraped_places" | "scraped_html" | "scraped_perplexity" | "unknown";
  role: string;
  composite: number;
  reasoning: string;
  subscores: {
    visual_quality: number;
    ambiance: number;
    offerings: number;
    brand_fit: number;
    informational: number;
    authenticity: number;
  };
}

interface CurateResponse {
  candidates?: Candidate[];
  selected?: string[];
  coverageGaps?: string[];
  tokenCost?: number;
  ranAt?: string;
  warning?: string;
  message?: string;
  error?: string;
  stage?: string;
}

export function CuratePhotosModal({
  recommendationId,
  open,
  onClose,
  onReplace,
}: {
  recommendationId: string;
  open: boolean;
  onClose: () => void;
  onReplace: (urls: string[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CurateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Kick off the fetch whenever the modal opens. Re-running curation is
  // cheap to trigger but expensive in tokens — that's why the button is
  // inside the modal rather than firing on mount of the form.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setData(null);
    setChecked({});
    (async () => {
      try {
        const res = await fetch("/api/admin/curate-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recommendationId }),
        });
        const json = (await res.json()) as CurateResponse;
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(
            json.error
              ? `${json.error}${json.stage ? ` (${json.stage})` : ""}`
              : "Couldn't score photos — try again.",
          );
          setLoading(false);
          return;
        }
        if (json.warning === "insufficient_pool") {
          setErrorMsg(json.message || "Not enough photos to curate.");
          setLoading(false);
          return;
        }
        setData(json);
        // Pre-check everything in `selected`.
        const initial: Record<string, boolean> = {};
        for (const url of json.selected ?? []) initial[url] = true;
        setChecked(initial);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recommendationId]);

  // Close on escape, disable body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const finalUrls = useMemo(() => {
    if (!data?.candidates) return [];
    // Preserve the selector's original role-priority ordering for any
    // pre-checked items, then append any admin-added ones in scored order.
    const selectedSet = new Set(
      (data.selected ?? []).filter((u) => checked[u] !== false),
    );
    const extra = data.candidates
      .filter((c) => checked[c.url] && !selectedSet.has(c.url))
      .sort((a, b) => b.composite - a.composite)
      .map((c) => c.url);
    const ordered = [
      ...(data.selected ?? []).filter((u) => checked[u]),
      ...extra,
    ];
    return ordered;
  }, [data, checked]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Curate photos</h2>
            {data?.tokenCost !== undefined && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                ${data.tokenCost.toFixed(3)} · {data.candidates?.length ?? 0} scored
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-500 dark:text-neutral-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Scoring photos — this takes 8–15 seconds.</p>
            </div>
          )}

          {errorMsg && !loading && (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500 mb-2">{errorMsg}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Close and re-open to retry.
              </p>
            </div>
          )}

          {data && !loading && !errorMsg && (
            <>
              {data.coverageGaps && data.coverageGaps.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                  Coverage gaps: {data.coverageGaps.map(humanizeRole).join(", ")} — no candidate met the quality threshold for these roles.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.candidates?.map((c) => {
                  const isChecked = !!checked[c.url];
                  return (
                    <label
                      key={c.url}
                      className={`relative group flex flex-col rounded-xl overflow-hidden border transition-all cursor-pointer ${
                        isChecked
                          ? "border-brand-500 ring-2 ring-brand-500/30"
                          : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [c.url]: e.target.checked }))
                        }
                      />
                      <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 relative">
                        <img
                          src={c.url}
                          alt={humanizeRole(c.role)}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isChecked && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                            <span className="text-white text-[10px] leading-none">✓</span>
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium truncate">
                            {humanizeRole(c.role)}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400 shrink-0 tabular-nums">
                            {c.composite.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400 line-clamp-2" title={c.reasoning}>
                          {c.reasoning}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {data && !loading && !errorMsg
              ? `${finalUrls.length} selected`
              : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-black/10 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !!errorMsg || finalUrls.length === 0}
              onClick={() => {
                onReplace(finalUrls);
                onClose();
              }}
              className="px-4 py-2 text-sm rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Replace photos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
