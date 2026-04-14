"use client";

import { useState } from "react";
import { submitReferral } from "@/app/actions/referrals";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ReferPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function formatPhone(digits: string): string {
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`;
  }

  const rawDigits = phone.replace(/\D/g, "");
  const fullPhone = `+1${rawDigits}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await submitReferral({
      name: name.trim(),
      phone: fullPhone,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  const inputStyle = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors";

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Standard Spaces" className="h-6 w-6 dark:invert" />
          </div>

          {submitted ? (
            <>
              <h1 className="mb-3">Invite sent</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                We&apos;ll text {name} with a link to apply. You&apos;ll be asked to approve their application.
              </p>
              <div className="mt-6 space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => { setSubmitted(false); setName(""); setPhone(""); }}
                >
                  Refer another friend
                </Button>
                <Link
                  href="/referrals"
                  className="block w-full py-2.5 text-sm text-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                >
                  View your referrals
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-1">Refer a friend</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                They&apos;ll receive a text with a link to apply.
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
              placeholder="Their name"
              required
              className={inputStyle}
              autoFocus
            />
            <input
              type="tel"
              value={formatPhone(rawDigits)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Their phone number"
              required
              className={inputStyle}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading || !name.trim() || rawDigits.length < 10}
            >
              {loading ? "Sending..." : "Send invite"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
