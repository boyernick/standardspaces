"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Globe, CheckCircle, Loader2 } from "lucide-react";

type Step = "form" | "success";

export default function RecommendForm() {
  const [step, setStep] = useState<Step>("form");
  const [url, setUrl] = useState("");
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
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { data: insertData, error: insertError } = await supabase
      .from("recommendations")
      .insert({
        url: url.trim(),
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
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-neutral-900" />
        </div>
        <h2 className="text-xl font-semibold">Thanks for the recommendation</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
          We'll review this space and add it to the guide if it meets our standards.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center px-6 py-3 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
        >
          Back to guide
        </a>
        <div className="mt-3">
          <button
            onClick={() => { setStep("form"); setUrl(""); }}
            className="text-sm text-neutral-900 hover:underline"
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
        <h1 className="text-xl font-medium mb-1" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Recommend a space</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
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
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!urlType || submitting}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          ) : (
            <>Submit recommendation</>
          )}
        </button>
      </div>
    </div>
  );
}
