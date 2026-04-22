"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { citySlugFromName } from "@/lib/cities";

const PHONE_PLACEHOLDER = "(555) 123 - 4567";

function LoginForm() {
  const searchParams = useSearchParams();
  const prefillRaw = (searchParams.get("phone") || "").replace(/\D/g, "").slice(-10);
  const [phone, setPhone] = useState(prefillRaw);
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Measure the placeholder's rendered width so we can park a fake caret
  // at the left edge of the centered placeholder. Keeps the input's typed
  // value centered while still cueing the user to type at the start —
  // otherwise the real caret sits in the middle of the placeholder text.
  const phoneMeasureRef = useRef<HTMLSpanElement>(null);
  const [phonePlaceholderWidth, setPhonePlaceholderWidth] = useState(0);
  // autoFocus fires onFocus synchronously on mount in most browsers, but
  // we default to true anyway so the fake caret is visible on first paint
  // without waiting for the focus event round trip.
  const [phoneFocused, setPhoneFocused] = useState(true);
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIsomorphicLayoutEffect(() => {
    if (phoneMeasureRef.current) {
      setPhonePlaceholderWidth(phoneMeasureRef.current.getBoundingClientRect().width);
    }
  }, []);

  function formatPhone(digits: string): string {
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`;
  }

  // Six-box OTP input: each box holds one digit. Typing auto-advances,
  // Backspace steps back, arrow keys navigate, and either a native paste
  // (cmd-v of the SMS code) or iOS SMS autofill — which drops the full
  // 6-digit code into whichever box has focus — fills all boxes at once.
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  function applyOtpDigits(index: number, digits: string) {
    const clean = digits.replace(/\D/g, "");
    if (clean.length === 0) {
      const next = otp.slice(0, index) + otp.slice(index + 1);
      setOtp(next);
      return;
    }
    // Splice the incoming digits in at `index`, then clamp to 6.
    const merged = (otp.slice(0, index) + clean + otp.slice(index + clean.length)).slice(0, 6);
    setOtp(merged);
    const nextFocus = Math.min(index + clean.length, 5);
    requestAnimationFrame(() => otpRefs.current[nextFocus]?.focus());
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Empty box — step back and clear the previous digit so repeated
        // backspaces feel natural instead of needing a second press.
        e.preventDefault();
        const next = otp.slice(0, index - 1) + otp.slice(index);
        setOtp(next);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    e.preventDefault();
    applyOtpDigits(index, pasted);
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
        // Look up application data to pre-populate profile
        const { data: appData } = await supabase
          .from("applications")
          .select("city, first_name, last_name, instagram")
          .eq("phone", fullPhone)
          .single();
        userCity = appData?.city || "Miami";

        await supabase.from("profiles").insert({
          id: data.user.id,
          phone: fullPhone,
          city: userCity,
          first_name: appData?.first_name || null,
          last_name: appData?.last_name || null,
          instagram: appData?.instagram || null,
          onboarded: true,
        });
      }
    }

    // Honor `?next=` when present so the shared-link flow (someone opens
    // a spot URL without an account and taps Sign in) lands back on that
    // spot after auth. Restrict to internal paths to prevent open redirects.
    const nextParam = searchParams.get("next");
    const safeNext =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : null;
    router.push(safeNext ?? `/${citySlugFromName(userCity)}`);
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
                6-digit code sent to{" "}
                <span className="font-medium">+1 {formatPhone(rawDigits)}</span>
              </p>
            </>
          )}
        </div>

        {sent ? (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  // Only the first box advertises one-time-code so the browser
                  // fires a single autofill event; iOS then drops the whole
                  // 6-digit code into that box, and our onChange below fans
                  // it out across the remaining inputs.
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  value={otp[i] ?? ""}
                  onChange={(e) => applyOtpDigits(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={(e) => handleOtpPaste(i, e)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="•"
                  required
                  className="w-11 h-12 text-center text-base border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors caret-brand-500"
                  style={fontCalibre}
                  autoFocus={i === 0}
                  aria-label={`Digit ${i + 1} of 6`}
                />
              ))}
            </div>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
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
            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={formatPhone(rawDigits)}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                placeholder={PHONE_PLACEHOLDER}
                required
                className={`${inputStyle} text-center ${rawDigits.length === 0 ? "caret-transparent" : "caret-brand-500"}`}
                style={fontCalibre}
                autoFocus
              />
              {/* Hidden measurer: same font/size as the input so its box
                  is exactly the placeholder's rendered width. Kept in the
                  layout (not display:none) so fonts affect it. */}
              <span
                ref={phoneMeasureRef}
                aria-hidden
                className="invisible absolute top-0 left-0 whitespace-pre text-sm"
                style={fontCalibre}
              >
                {PHONE_PLACEHOLDER}
              </span>
              {/* Fake caret: shown only when the input is empty + focused.
                  Real caret is hidden (caret-transparent) in that state so
                  we don't show two. Once the user types, the class flips
                  back to caret-brand-500 and the real caret takes over. */}
              {rawDigits.length === 0 && phoneFocused && phonePlaceholderWidth > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-px h-4 bg-brand-500"
                  style={{
                    left: `calc(50% - ${phonePlaceholderWidth / 2}px)`,
                    animation: "caret-blink 1s step-start infinite",
                  }}
                />
              )}
              <style>{`@keyframes caret-blink { 50% { opacity: 0; } }`}</style>
            </div>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading || rawDigits.length < 10}
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
              style={fontCalibre}
            >
              {loading ? "Sending..." : "Send login code"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
