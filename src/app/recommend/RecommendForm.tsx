"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Globe, CheckCircle, Loader2, Plus, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

type Step = "form" | "success";

export default function RecommendForm() {
  const [step, setStep] = useState<Step>("form");
  const [url, setUrl] = useState("");
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

    const supabase = createClient();
    const { data: insertData, error: insertError } = await supabase
      .from("recommendations")
      .insert({
        url: url.trim(),
        additional_urls: cleanedExtras,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError || !insertData) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setStep("success");

    // Trigger background processing (don't await — let it run async)
    fetch("/api/recommend/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId: insertData.id }),
    }).catch(() => {});
  }

  if (step === "success") {
    return (
      <div className="mt-12 text-center">
        <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-neutral-900 dark:text-white" />
        </div>
        <h2>Thanks for the recommendation</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
          We'll review this space and add it to the guide if it meets our standards.
        </p>
        <div className="mt-6">
          <ButtonLink href="/" variant="primary">Back to guide</ButtonLink>
        </div>
        <div className="mt-3">
          <button
            onClick={() => { setStep("form"); setUrl(""); setAdditionalUrls([]); }}
            className="text-sm text-neutral-900 dark:text-white hover:underline"
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
