"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { citySlugFromName } from "@/lib/cities";
import Link from "next/link";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

    // Admin bypass — skip SMS verification
    const bypassRes = await fetch("/api/auth/admin-bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone }),
    });

    if (bypassRes.ok) {
      const bypassData = await bypassRes.json().catch(() => ({}));
      const slug = bypassData.city ? citySlugFromName(bypassData.city) : "miami";
      router.push(`/${slug}`);
      return;
    }

    // Normal flow — send SMS OTP
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: fullPhone });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp.trim(),
      type: "sms",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    // Check application status
    const res = await fetch("/api/auth/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone }),
    });

    if (!res.ok) {
      const result = await res.json();
      // Sign out since they're not approved
      await supabase.auth.signOut();
      setError(result.error || "Something went wrong.");
      setSent(false);
      setOtp("");
      setLoading(false);
      return;
    }

    // Ensure profile exists and get city
    let userCity = "Miami";
    if (data.user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, city")
        .eq("id", data.user.id)
        .single();

      if (existing) {
        userCity = existing.city || "Miami";
      } else {
        // Look up city from application
        const { data: appData } = await supabase
          .from("applications")
          .select("city")
          .eq("phone", fullPhone)
          .single();
        userCity = appData?.city || "Miami";

        await supabase.from("profiles").insert({
          id: data.user.id,
          phone: fullPhone,
          city: userCity,
        });
      }
    }

    router.push(`/${citySlugFromName(userCity)}`);
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
          {!sent ? (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Welcome back</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                Enter your number to sign in.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Enter your code</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                6-digit code sent to {fullPhone}
              </p>
            </>
          )}
        </div>

        {sent ? (
          <form onSubmit={handleVerifyCode} className="space-y-4">
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
              {loading ? "Verifying..." : "Verify code"}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setOtp(""); setError(""); }}
              className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              style={fontCalibre}
            >
              Use a different number
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendCode} className="space-y-4">
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
              {loading ? "Sending..." : "Send login code"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/apply"
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            style={fontCalibre}
          >
            Not a member? Apply to join
          </Link>
        </div>
      </div>
    </div>
  );
}
