"use client";

import { Suspense, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkApplicationByPhone, requestApplyOtp, submitApplication } from "@/app/actions/apply";
import Link from "next/link";

type Step = "phone" | "verify" | "details" | "submitted" | "approved";

const PHONE_PLACEHOLDER = "(555) 123 - 4567";

function ApplyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refId = searchParams.get("ref");

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagram, setInstagram] = useState("");
  // Miami-only at launch. When we open more cities this becomes state
  // driven by a <select> again.
  const city = "Miami";
  const [referredByName, setReferredByName] = useState("");
  const [referredByPhone, setReferredByPhone] = useState("");
  const [referrerDisplayName, setReferrerDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If ?ref= param present, look up the referrer's name
  useEffect(() => {
    if (!refId) return;
    const supabase = createClient();
    (async () => {
      try {
        const res = await fetch(`/api/referral-info?id=${refId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.referrerName) {
            setReferrerDisplayName(data.referrerName);
          }
        }
      } catch {
        // Ignore — will just not show referrer name
      }
    })();
  }, [refId]);

  function formatPhone(digits: string): string {
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`;
  }

  // Measure placeholder width so the empty-state caret sits at the left
  // edge of the centered placeholder rather than in the middle of it.
  const phoneMeasureRef = useRef<HTMLSpanElement>(null);
  const [phonePlaceholderWidth, setPhonePlaceholderWidth] = useState(0);
  const [phoneFocused, setPhoneFocused] = useState(true);
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIsomorphicLayoutEffect(() => {
    if (phoneMeasureRef.current) {
      setPhonePlaceholderWidth(phoneMeasureRef.current.getBoundingClientRect().width);
    }
  }, []);

  // Six-box OTP input refs + helpers — typing auto-advances, Backspace
  // steps back (clearing the previous digit), arrow keys navigate, and
  // paste / iOS SMS autofill fills all boxes.
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  function applyOtpDigits(index: number, digits: string) {
    const clean = digits.replace(/\D/g, "");
    if (clean.length === 0) {
      const next = otp.slice(0, index) + otp.slice(index + 1);
      setOtp(next);
      return;
    }
    const merged = (otp.slice(0, index) + clean + otp.slice(index + clean.length)).slice(0, 6);
    setOtp(merged);
    const nextFocus = Math.min(index + clean.length, 5);
    requestAnimationFrame(() => otpRefs.current[nextFocus]?.focus());
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
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

    // Block applying if this phone already has an application on file.
    // We intentionally don't distinguish approved vs pending here to avoid
    // leaking membership status to unauthenticated callers — the login page
    // will surface the right next step once they verify ownership.
    const { canApply } = await checkApplicationByPhone(fullPhone);
    if (!canApply) {
      router.push(`/login?phone=${encodeURIComponent(fullPhone)}`);
      return;
    }

    // Per-phone rate limit gate before burning an SMS credit.
    const gate = await requestApplyOtp(fullPhone);
    if (!gate.allowed) {
      setError(gate.error);
      setLoading(false);
      return;
    }

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

  const refRawDigits = referredByPhone.replace(/\D/g, "");
  const refFullPhone = referredByPhone.startsWith("+") ? referredByPhone : `+1${refRawDigits}`;

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
      referredByName: referredByName.trim() || undefined,
      referredByPhone: refRawDigits.length === 10 ? refFullPhone : undefined,
      referralId: refId || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep(result.autoApproved ? "approved" : "submitted");
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

          {step === "approved" ? (
            <>
              <h1 className="text-xl font-medium mb-3" style={fontMartina}>You&apos;re in</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6" style={fontCalibre}>
                Welcome to Standard Spaces.
              </p>
              <Link
                href={`/login?phone=${encodeURIComponent(fullPhone)}`}
                className="inline-block px-6 py-2.5 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                style={fontCalibre}
              >
                Sign in
              </Link>
            </>
          ) : step === "submitted" ? (
            <>
              <h1 className="text-xl font-medium mb-3" style={fontMartina}>Application received</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                We&apos;ll review your application and text you when you&apos;re approved.
              </p>
            </>
          ) : step === "details" ? (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Submit your application</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                Tell us about yourself
              </p>
            </>
          ) : step === "verify" ? (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Enter your code</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                6-digit code sent to{" "}
                <span className="font-medium">+1 {formatPhone(rawDigits)}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1" style={fontMartina}>Apply to join</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                Standard Spaces is a members-only, curated guide.
              </p>
            </>
          )}
        </div>

        {step === "phone" && (
          <form onSubmit={handleSendCode} className="space-y-3">
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
              <span
                ref={phoneMeasureRef}
                aria-hidden
                className="invisible absolute top-0 left-0 whitespace-pre text-sm"
                style={fontCalibre}
              >
                {PHONE_PLACEHOLDER}
              </span>
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
              {loading ? "Sending..." : "Send verification code"}
            </button>
            {/* SMS consent — kept brief (Airbnb-style) with the key
                disclosures at the opt-in moment: what you're agreeing to,
                rates notice, STOP, and a link to /privacy#sms-consent
                where the full Twilio-required detail lives (message
                types, frequency, HELP, sample messages). */}
            <p
              id="sms-consent"
              className="pt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400"
              style={fontCalibre}
            >
              We&apos;ll text a sign-in code and occasional account
              updates (application status, event reminders, referrals).
              Msg &amp; data rates may apply. Reply STOP to opt out.{" "}
              <Link
                href="/privacy#sms-consent"
                className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
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
            {/* `@` is baked into the field as a static affordance (same
                pattern as protocol prefixes on URL inputs) so the user types
                only their handle. We still strip a leading `@` on change in
                case they paste `@handle` or copy from the browser address bar. */}
            <div className="relative">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-500"
                style={fontCalibre}
                aria-hidden="true"
              >
                @
              </span>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace(/^@+/, ""))}
                placeholder="Instagram (optional)"
                className={`${inputStyle} pl-[1.65rem]`}
                style={fontCalibre}
              />
            </div>
            {/* City is hardcoded to Miami at launch — only populated city. When
                we open additional cities this becomes a <select> again (see
                git history for the previous dropdown + `getPopulatedCities`
                warning pattern). */}

            {/* Referral fields — when a ?ref=<id> link is present the referral
                is already encoded in the URL, so we only render the "Referred by"
                chip (if we resolved the referrer's name) and hide the manual
                referrer inputs entirely. */}
            {refId ? (
              referrerDisplayName ? (
                <div className="px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
                  Referred by {referrerDisplayName}
                </div>
              ) : null
            ) : (
              <>
                <div className="pt-2">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-2" style={fontCalibre}>
                    Know a member?
                  </p>
                </div>
                <input
                  type="text"
                  value={referredByName}
                  onChange={(e) => setReferredByName(e.target.value)}
                  placeholder="Member's name"
                  className={inputStyle}
                  style={fontCalibre}
                />
                <input
                  type="tel"
                  value={formatPhone(refRawDigits)}
                  onChange={(e) => setReferredByPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Member's number"
                  className={inputStyle}
                  style={fontCalibre}
                />
              </>
            )}
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
              style={fontCalibre}
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense>
      <ApplyForm />
    </Suspense>
  );
}
