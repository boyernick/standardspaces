"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // Check if this email has been approved
    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

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
          {!sent && (
            <>
              <h1 className="text-xl font-medium mb-1" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
                Welcome back
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
                Enter your email to receive a login link.
              </p>
            </>
          )}
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-neutral-900 dark:text-white mb-2" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
              Check your email for a login link.
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
              Sent to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
              style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
            />
            {error && (
              <p className="text-xs text-red-600" style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-brand-900 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
            >
              {loading ? "Sending..." : "Send login link"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/apply"
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
          >
            Don&apos;t have an account? Apply to join
          </Link>
        </div>
      </div>
    </div>
  );
}
