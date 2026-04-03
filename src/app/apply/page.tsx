"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication } from "@/app/actions/apply";
import Link from "next/link";

type Step = "phone" | "verify" | "details" | "submitted";

export default function ApplyPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fullPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: fullPhone });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setStep("verify");
    setLoading(false);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp.trim(),
      type: "sms",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    setStep("details");
    setLoading(false);
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await submitApplication({
      firstName,
      lastName,
      instagram,
      phone: fullPhone,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep("submitted");
    setLoading(false);
  }

  const inputStyle = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors";
  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-6">
            <img src="/logo.svg" alt="Standard Spaces" className="h-5 w-5 dark:invert" />
            <span className="text-lg tracking-tight text-neutral-900 dark:text-white" style={fontMartina}>
              Standard Spaces
            </span>
          </div>

          {step === "submitted" ? (
            <>
              <h1 className="text-xl font-medium mb-3" style={fontMartina}>Application received</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                We&apos;ll review your application and text you when you&apos;re approved.
              </p>
            </>
          ) : step === "details" ? (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Almost there</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                Tell us a bit about yourself.
              </p>
            </>
          ) : step === "verify" ? (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Enter your code</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                6-digit code sent to {fullPhone}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Apply to join</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                Standard Spaces is a curated, members-only guide.
              </p>
            </>
          )}
        </div>

        {step === "phone" && (
          <form onSubmit={handleSendCode} className="space-y-3">
            <div className="flex gap-2">
              <span className="flex items-center px-3 text-sm text-neutral-500 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800" style={fontCalibre}>
                +1
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="(555) 123-4567"
                required
                className={inputStyle}
                style={fontCalibre}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, "").length < 10}
              className="w-full py-2.5 text-sm font-medium text-white bg-brand-900 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={fontCalibre}
            >
              {loading ? "Sending..." : "Send verification code"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              className={`${inputStyle} text-center tracking-[0.3em]`}
              style={fontCalibre}
              autoFocus
            />
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 text-sm font-medium text-white bg-brand-900 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={fontCalibre}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              style={fontCalibre}
            >
              Use a different number
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmitApplication} className="space-y-3">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
              className={inputStyle}
              style={fontCalibre}
              autoFocus
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              required
              className={inputStyle}
              style={fontCalibre}
            />
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram handle"
              required
              className={inputStyle}
              style={fontCalibre}
            />
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-brand-900 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
              style={fontCalibre}
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>
          </form>
        )}

        {step !== "submitted" && (
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              style={fontCalibre}
            >
              Already a member? Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
