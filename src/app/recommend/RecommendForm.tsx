"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { Globe, CheckCircle, Loader2, Plus, X, Info } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  checkDuplicateRecommendation,
  type DuplicateCheckResult,
} from "@/app/actions/recommendations";

type Step = "form" | "success" | "duplicate";

export default function RecommendForm() {
  const [step, setStep] = useState<Step>("form");
  const [url, setUrl] = useState("");
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateCheckResult | null>(null);

  const urlType = detectUrlType(url);

  function detectUrlType(u: string): string | null {
    if (!u.trim()) return null;
    if (u.includes("google.com/maps") || u.includes("goo.gl/maps")) return "Google Maps";
    if (u.includes("maps.apple.com")) return "Apple Maps";
    if (u.includes("instagram.com")) return "Instagram";
    if (u.includes("yelp.com")) return "Yelp";
    if (u.includes("resy.com")) return "Resy";
    if (u.includes("opentable.com")) return "OpenTable";
    try {
      new URL(u);
      return "Website";
    } catch {
      return null;
    }
  }

  async function handleSubmit() {
    if (!url.trim() || !urlType) {
      setError("Please paste a valid URL");
      return;
    }
    // Validate any additional URLs that have been filled in
    const cleanedExtras = additionalUrls.map((u) => u.trim()).filter(Boolean);
    for (const extra of cleanedExtras) {
      if (!detectUrlType(extra)) {
        setError("One of your additional links isn't a valid URL");
        return;
      }
    }
    setSubmitting(true);
    setError("");

    // Duplicate check — hits the server before we burn an insert + scrape
    // cycle. If the URL matches a live spot or someone's open submission,
    // short-circuit to the duplicate screen instead of writing another row.
    const dupe = await checkDuplicateRecommendation(url.trim(), cleanedExtras);
    if (dupe.kind !== "none") {
      setSubmitting(false);
      setDuplicate(dupe);
      setStep("duplicate");
      track("recommend_duplicate_blocked", {
        kind: dupe.kind,
        url_type: urlType ?? "unknown",
      });
      return;
    }

    const supabase = createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const { data: insertData, error: insertError } = await supabase
      .from("recommendations")
      .insert({
        url: url.trim(),
        additional_urls: cleanedExtras,
        // Stamp user_id explicitly. Before this, user_id was nullable with
        // no DB default, so submissions were orphaned and the /recommend
        // hub (filtered to .eq("user_id", user.id)) never saw them.
        user_id: userRes.user?.id,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError || !insertData) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setStep("success");

    // Conversion event. Fires only on confirmed insert — the guard above
    // rejects failures. `url_type` captures source provenance (Google
    // Maps vs. Instagram vs. a bare website URL) for funnel segmentation.
    track("recommend_submit", {
      url_type: urlType ?? "unknown",
      extras_count: cleanedExtras.length,
    });

    // Trigger background processing (don't await — let it run async)
    fetch("/api/recommend/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId: insertData.id }),
    }).catch(() => {});
  }

  if (step === "duplicate" && duplicate) {
    const resetForm = () => {
      setStep("form");
      setUrl("");
      setAdditionalUrls([]);
      setDuplicate(null);
    };

    if (duplicate.kind === "published") {
      const { spot } = duplicate;
      const subtitle = [spot.neighborhood, (spot.category ?? []).join(" · ")]
        .filter(Boolean)
        .join(" · ");
      return (
        <div className="py-16 sm:py-20 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100">
            <CheckCircle size={24} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
          </div>
          <h2>Already in the guide</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
            This space is already on Standard Spaces.
          </p>

          <Link
            href={`/${spot.citySlug}/${spot.id}`}
            className="mt-8 mx-auto max-w-sm flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-surface overflow-hidden text-left hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            {/* Concentric radii: outer = inner + padding. Outer is
                rounded-2xl (16px), image sits inset by m-2 (8px), so
                inner is rounded-lg (8px). 16 = 8 + 8 → parallel curves
                with a uniform gap all the way around. */}
            <div className="relative w-16 h-16 shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden m-2 mr-0">
              {spot.image ? (
                <Image
                  src={spot.image}
                  alt={spot.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 py-3 pr-4">
              <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {spot.name}
              </div>
              {subtitle && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  {subtitle}
                </div>
              )}
            </div>
          </Link>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={`/${spot.citySlug}/${spot.id}`} variant="primary">
              View space
            </ButtonLink>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
            >
              Recommend another
            </button>
          </div>
        </div>
      );
    }

    // kind === "pending"
    return (
      <div className="py-16 sm:py-20 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100">
          <Info size={24} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
        </div>
        <h2>Already recommended</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
          {duplicate.mine
            ? "You've already submitted this space. We're reviewing it now."
            : "Someone already submitted this space. We're reviewing it now."}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/recommend" variant="primary">
            View recommendations
          </ButtonLink>
          <button
            onClick={resetForm}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            Recommend another
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    const submittedLinks = [url.trim(), ...additionalUrls.map((u) => u.trim()).filter(Boolean)];
    return (
      <div className="py-16 sm:py-20 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100">
          <CheckCircle size={24} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
        </div>
        <h2>Recommendation received</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
          We&apos;ll review this space and add it to the guide if it meets our standards.
        </p>

        {submittedLinks.length > 0 && (
          <div className="mt-8 mx-auto max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface overflow-hidden text-left">
            {submittedLinks.map((link, i) => {
              const type = detectUrlType(link) ?? "Link";
              let host = link;
              try { host = new URL(link).hostname.replace(/^www\./, ""); } catch {}
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 text-xs ${i > 0 ? "border-t border-neutral-100 dark:border-neutral-900" : ""}`}
                >
                  <Globe size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-neutral-900 dark:text-white truncate">{host}</div>
                    <div className="text-neutral-400 dark:text-neutral-500 mt-0.5">{type}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/recommend" variant="primary">View recommendations</ButtonLink>
          <button
            onClick={() => { setStep("form"); setUrl(""); setAdditionalUrls([]); }}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            Recommend another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="mb-1">Recommend a space</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Paste a link and we&apos;ll take it from there.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && urlType) handleSubmit(); }}
            placeholder="Paste a link to the space — website, Instagram, etc."
            className="w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
            autoFocus
          />
          {urlType && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 flex items-center gap-1.5">
              <Globe size={12} strokeWidth={1.5} />
              Detected: {urlType}
            </p>
          )}
        </div>

        {additionalUrls.map((extra, i) => {
          const extraType = detectUrlType(extra);
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={extra}
                  onChange={(e) => {
                    const next = [...additionalUrls];
                    next[i] = e.target.value;
                    setAdditionalUrls(next);
                    setError("");
                  }}
                  placeholder="Add another link (optional)"
                  className="flex-1 px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setAdditionalUrls(additionalUrls.filter((_, j) => j !== i))}
                  aria-label="Remove link"
                  className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
              {extraType && extra.trim() && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 flex items-center gap-1.5">
                  <Globe size={12} strokeWidth={1.5} />
                  Detected: {extraType}
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setAdditionalUrls([...additionalUrls, ""])}
          className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
        >
          <Plus size={12} strokeWidth={2} />
          Add another link
        </button>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={!urlType || submitting}
          variant="primary"
          className="w-full"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          ) : (
            <>Submit recommendation</>
          )}
        </Button>
      </div>
    </div>
  );
}
