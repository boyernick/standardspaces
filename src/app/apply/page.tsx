"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication } from "@/app/actions/apply";
import { getPopulatedCities } from "@/app/actions/cities";
import { CITIES } from "@/lib/cities";
import Link from "next/link";

type Step = "phone" | "verify" | "details" | "submitted";

export default function ApplyPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [city, setCity] = useState("Miami");
  const [populatedCities, setPopulatedCities] = useState<string[]>([]);
  const [cityWarning, setCityWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPopulatedCities().then(setPopulatedCities);
  }, []);

  function formatPhone(digits: string): string {
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`;
  }

  const rawDigits = phone.replace(/\D/g, "");
  const fullPhone = phone.startsWith("+") ? phone : `+1${rawDigits}`;

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
      city,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep("submitted");
    setLoading(false);
  }

  const inputStyle = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors";
  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Standard Spaces" className="h-6 w-6 dark:invert" />
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
            <div>
              <input
                type="tel"
                value={formatPhone(rawDigits)}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="(555) 123 - 4567"
                required
                className={`${inputStyle} text-center`}
                style={fontCalibre}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || rawDigits.length < 10}
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
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
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
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
            <select
              value={city}
              onChange={(e) => {
                const picked = e.target.value;
                setCity(picked);
                if (populatedCities.length > 0 && !populatedCities.includes(picked)) {
                  setCityWarning(`We're not in ${picked} yet — pick another city to start with.`);
                } else {
                  setCityWarning("");
                }
              }}
              className={inputStyle}
              style={fontCalibre}
            >
              {CITIES.map((c) => (
                <option key={c.slug} value={c.name}>{c.name}</option>
              ))}
            </select>
            {cityWarning && <p className="text-xs text-amber-600" style={fontCalibre}>{cityWarning}</p>}
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !!cityWarning}
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
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
              Already a member? Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
