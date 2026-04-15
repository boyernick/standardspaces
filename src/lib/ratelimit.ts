/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * On Vercel's serverless runtime each lambda instance has its own Map, so
 * state is not shared across instances — a determined attacker can still
 * burst across cold starts. For launch-week scale this still blunts the
 * obvious per-instance floods (scripts hammering one endpoint from one IP).
 *
 * Swap for @upstash/ratelimit + Vercel KV once traffic justifies it: the
 * exported shape of `checkRateLimit` is compatible with a drop-in replacement.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Token bucket keyed by an arbitrary string (e.g. `otp:<phone>`, `apply:<ip>`).
 * @param key unique identifier for the rate-limit scope
 * @param limit max hits per window
 * @param windowMs window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { success: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** 3 OTP sends per phone per hour. */
export const otpLimit = (phone: string) =>
  checkRateLimit(`otp:${phone}`, 3, 60 * 60 * 1000);

/** 5 application submits per IP per hour. */
export const applyLimit = (ip: string) =>
  checkRateLimit(`apply:${ip}`, 5, 60 * 60 * 1000);
