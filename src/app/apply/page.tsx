"use client";

import { useState } from "react";
import Link from "next/link";
import { submitApplication } from "@/app/actions/apply";

export default function ApplyPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [reason, setReason] = useState("");
  const [referral, setReferral] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await submitApplication({ name, email, instagram, reason, referral });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  const inputStyle = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors";
  const fontCalibr = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-6">
            <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5 dark:invert" />
            <span className="text-lg tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
              Standard Spaces
            </span>
          </div>

          {submitted ? (
            <>
              <h1 className="text-xl font-medium mb-3" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
                Application received
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibr}>
                We&apos;ll review your application and send you a login link if approved.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
                Apply to join
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibr}>
                Standard Spaces is a curated, members-only guide.
              </p>
            </>
          )}
        </div>

        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className={inputStyle}
              style={fontCalibr}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={inputStyle}
              style={fontCalibr}
            />
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram handle (optional)"
              className={inputStyle}
              style={fontCalibr}
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you want to join? (optional)"
              rows={3}
              className={`${inputStyle} resize-none`}
              style={fontCalibr}
            />
            <input
              type="text"
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
              placeholder="How did you hear about us? (optional)"
              className={inputStyle}
              style={fontCalibr}
            />
            {error && (
              <p className="text-xs text-red-600" style={fontCalibr}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-brand-900 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={fontCalibr}
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            style={fontCalibr}
          >
            Already a member? Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
