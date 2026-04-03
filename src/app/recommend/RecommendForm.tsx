"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import { Link2, MapPin, ChevronDown, CheckCircle, Loader2 } from "lucide-react";

type Step = "url" | "details" | "success";

export default function RecommendForm() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
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

  function handleUrlContinue() {
    if (!url.trim()) return;
    if (!urlType) {
      setError("Please paste a valid URL");
      return;
    }
    setError("");
    setStep("details");
  }

  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { data: insertData, error: insertError } = await supabase
      .from("recommendations")
      .insert({
        url: url.trim(),
        name: name.trim() || null,
        category: category || null,
        neighborhood: neighborhood.trim() || null,
        notes: notes.trim() || null,
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
        <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-950 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-brand-900" />
        </div>
        <h2 className="text-xl font-semibold">Thanks for the recommendation</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
          We'll review this space and add it to the guide if it meets our standards.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center px-6 py-3 bg-brand-900 text-white text-sm font-medium rounded-full hover:bg-brand-800 transition-colors"
        >
          Back to guide
        </a>
        <div className="mt-3">
          <button
            onClick={() => { setStep("url"); setUrl(""); setName(""); setCategory(""); setNeighborhood(""); setNotes(""); }}
            className="text-sm text-brand-900 hover:underline"
          >
            Recommend another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-center">Recommend a space</h1>
      <p className="text-base text-neutral-500 dark:text-neutral-400 mt-2 text-center">
        Know a place that belongs on Standard Spaces?<br />Share it with us. Paste a link and we'll take it from there.
      </p>

      <div className="mt-8 space-y-6">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Link</label>
        <div className="relative">
          <Link2 size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlContinue(); }}
            placeholder="Paste a URL — website, Google Maps, Apple Maps, Instagram..."
            className="w-full pl-10 pr-4 py-3 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
            autoFocus
          />
        </div>
        {urlType && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 flex items-center gap-1.5">
            <MapPin size={12} strokeWidth={1.5} />
            Detected: {urlType}
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>

      {step === "url" && (
        <button
          onClick={handleUrlContinue}
          disabled={!urlType}
          className="w-full py-3 text-sm font-medium rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-40 disabled:cursor-default transition-colors"
        >
          Continue
        </button>
      )}

      {step === "details" && (
        <>
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
              Optional — help us get it right faster
            </p>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What's the place called?"
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
              />
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 pr-10 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                >
                  <option value="">Select a category</option>
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* Neighborhood */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Neighborhood</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. Wynwood, Brickell, South Beach"
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Why this place?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What makes it special? Any tips for first-timers?"
                rows={3}
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 text-sm font-medium rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Submitting...</>
            ) : (
              <>Submit recommendation</>
            )}
          </button>
        </>
      )}
      </div>
    </div>
  );
}
