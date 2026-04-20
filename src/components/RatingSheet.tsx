"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Spot } from "@/lib/types";
import {
  BUCKET_LABELS,
  BUCKETS,
  pickComparisonIndex,
  type Bucket,
} from "@/lib/ratings";
import {
  getBucketPool,
  getSpotForCompare,
  submitRating,
} from "@/app/actions/ratings";

type Step = "bucket" | "compare";

export default function RatingSheet({
  spotId,
  spotName,
  initialBucket,
  open,
  onClose,
}: {
  spotId: string;
  spotName: string;
  initialBucket?: Bucket | null;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("bucket");
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [pool, setPool] = useState<{ spot: Spot }[]>([]);
  const [targetSpot, setTargetSpot] = useState<Spot | null>(null);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mark mounted so the portal only renders once `document.body` is
  // guaranteed to exist (avoids hydration-time "target is not a DOM element").
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state every time the sheet is opened so re-rate reuses the flow
  // cleanly on the next open.
  useEffect(() => {
    if (!open) return;
    setStep("bucket");
    setBucket(null);
    setPool([]);
    setTargetSpot(null);
    setLo(0);
    setHi(0);
    setSubmitting(false);
    // Fetch the target spot so the compare card can show its actual image
    // and neighborhood/category, matching the challenger card's treatment.
    (async () => {
      const s = await getSpotForCompare(spotId);
      setTargetSpot(s);
    })();
  }, [open, spotId]);

  // Body scroll lock + Esc-to-close, matching ShareButton's sheet chrome.
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

  const finalize = useCallback(
    async (chosenBucket: Bucket, rank: number) => {
      setSubmitting(true);
      await submitRating(spotId, chosenBucket, rank);
      setSubmitting(false);
      // Close immediately once the server write lands — no score reveal.
      onClose();
    },
    [spotId, onClose],
  );

  async function handleBucketPick(b: Bucket) {
    setBucket(b);
    const list = await getBucketPool(b, spotId);
    setPool(list);
    if (list.length === 0) {
      // First rating in this bucket: no comparison needed, land at rank 1
      // (also the only slot). scoreForRank collapses to the bucket midpoint.
      await finalize(b, 1);
      return;
    }
    setLo(0);
    setHi(list.length); // inclusive upper bound on the new slot index
    setStep("compare");
  }

  function endCompareWithRank(rank: number) {
    if (!bucket) return;
    finalize(bucket, rank);
  }

  function onChooseNew() {
    // The new space wins → insert before the midpoint candidate.
    const mid = pickComparisonIndex(lo, hi - 1);
    const newHi = mid;
    if (lo >= newHi) {
      endCompareWithRank(lo + 1);
      return;
    }
    setHi(newHi);
  }

  function onChooseExisting() {
    // The existing space wins → insert after the midpoint candidate.
    const mid = pickComparisonIndex(lo, hi - 1);
    const newLo = mid + 1;
    if (newLo >= hi) {
      endCompareWithRank(newLo + 1);
      return;
    }
    setLo(newLo);
  }

  function onTooClose() {
    // Split the current window and submit at its midpoint.
    const mid = Math.floor((lo + hi) / 2);
    endCompareWithRank(mid + 1);
  }

  if (!open || !mounted) return null;

  const midIdx =
    step === "compare" && pool.length > 0
      ? pickComparisonIndex(lo, hi - 1)
      : 0;
  const challenger = pool[midIdx]?.spot;

  // Portal to body so the `fixed` overlay isn't scoped by a transformed
  // ancestor (e.g. the FadeIn/animation wrappers on the space page, which
  // create a containing block via CSS transform).

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Rate this space"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
      />

      <div className="relative w-full sm:max-w-md bg-surface sm:rounded-2xl rounded-t-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 pb-[max(1rem,env(safe-area-inset-bottom))] animate-[slideUp_220ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="relative px-5 pt-5 pb-2">
          <h2 className="text-center text-base font-semibold">
            {`How was ${spotName}?`}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} className="text-neutral-600 dark:text-neutral-300" />
          </button>
        </div>

        {step === "bucket" && (
          <div className="px-5 pb-5 space-y-2">
            {BUCKETS.map((b) => {
              const active = initialBucket === b;
              return (
                <button
                  key={b}
                  onClick={() => handleBucketPick(b)}
                  disabled={submitting}
                  className={`w-full px-4 py-3 text-sm rounded-lg border transition-colors text-left ${
                    active
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                      : "bg-surface text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  {BUCKET_LABELS[b]}
                </button>
              );
            })}
            <button
              onClick={onClose}
              className="w-full mt-1 px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "compare" && challenger && (
          <div className="px-5 pb-5">
            <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Which did you like more?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SpaceCompareCard
                label={targetSpot?.name ?? spotName}
                subtitle={[
                  targetSpot?.neighborhood,
                  targetSpot?.subcategory?.[0] ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                imageUrl={targetSpot?.images?.[0] ?? null}
                onClick={onChooseNew}
              />
              <SpaceCompareCard
                label={challenger.name}
                subtitle={[
                  challenger.neighborhood,
                  challenger.subcategory?.[0] ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                imageUrl={challenger.images?.[0] ?? null}
                onClick={onChooseExisting}
              />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onTooClose}
                className="flex-1 !py-3"
              >
                Too close to call
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onTooClose}
                className="flex-1 !py-3"
              >
                Too different to compare
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body,
  );
}

function SpaceCompareCard({
  label,
  subtitle,
  imageUrl,
  onClick,
}: {
  label: string;
  subtitle: string;
  imageUrl: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
    >
      <div className="aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : null}
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium truncate">{label}</p>
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </button>
  );
}
