// Typed wrapper around Vercel Web Analytics custom events.
//
// Why this file exists:
//   * `@vercel/analytics` ships a permissive `track(name, props)` — any string,
//     any shape. Left untyped, call sites drift (`rsvp_create` vs `rsvpCreate`,
//     `spot_id` vs `spotId`, missing properties) and downstream funnels break
//     silently. We define the event catalog once, as a discriminated union,
//     and compile-check every call site against it.
//   * Vercel Analytics has no global `identify()` — user association must be
//     attached per-event. We keep the current user's id in a module-level ref,
//     seeded by `<AnalyticsIdentity />` on the client, and auto-stamp every
//     client event with `user_id`. Server call sites pass it explicitly (they
//     already hold `user.id` from `requireAuth()` / `auth.getUser()`).
//   * Both surfaces (client `track` and server `@vercel/analytics/server`
//     `track`) go through this module so the catalog is the single source of
//     truth — no raw vendor calls outside this file.
//
// Allowed property values are `string | number | boolean | null` (Vercel
// constraint). No nested objects, no arrays — flatten to scalar keys.

import { track as vercelTrackClient } from "@vercel/analytics";
import { track as vercelTrackServer } from "@vercel/analytics/server";

/**
 * The full event catalog. Add new events here — shape enforced everywhere
 * via the discriminated union below.
 *
 * Keep property sets small (3-6 keys) and scalar. `user_id` is stamped
 * automatically on the client and should be passed explicitly on the server.
 */
export type AnalyticsEvent =
  // Recommendation flow
  | { name: "recommend_submit"; props: { url_type: string; extras_count: number } }
  // Fires when the form short-circuits on a duplicate match (either an
  // already-published spot or another open recommendation). Tracks what
  // kind of collision happened so we can see how often the submit flow
  // is catching dupes vs. inserting fresh rows.
  | { name: "recommend_duplicate_blocked"; props: { kind: "published" | "pending"; url_type: string } }
  // Events
  | { name: "rsvp_create"; props: { event_id: string; status: "going" | "waitlist" } }
  | { name: "rsvp_cancel"; props: { event_id: string; was_going: boolean } }
  | { name: "event_view"; props: { event_id: string } }
  // Check-ins
  | { name: "checkin_create"; props: { spot_id: string } }
  // Follows
  | { name: "follow_user"; props: { target_id: string } }
  | { name: "unfollow_user"; props: { target_id: string } }
  // Auth
  | { name: "signup_complete"; props: { city: string } }
  | { name: "signin"; props: Record<string, never> }
  // Spot views
  | { name: "spot_view"; props: { spot_id: string; city: string } }
  // Admin
  | { name: "publish_spot"; props: { spot_id: string; city: string } };

type EventName = AnalyticsEvent["name"];
type PropsFor<N extends EventName> = Extract<AnalyticsEvent, { name: N }>["props"];

/**
 * Module-level identity ref. Populated by `<AnalyticsIdentity />` on the
 * client once we know who's signed in; stays `null` for anonymous sessions.
 *
 * NOT safe to read on the server — Node module state is per-process and
 * will leak across requests. Server `track()` takes `user_id` explicitly.
 */
let currentUserId: string | null = null;

/**
 * Called by `<AnalyticsIdentity />` when the Supabase auth state resolves
 * or changes. Passing `null` on sign-out clears the ref so subsequent
 * anonymous events don't carry a stale user id.
 */
export function setAnalyticsIdentity(userId: string | null): void {
  currentUserId = userId;
}

/** Read-only accessor for debugging / tests. */
export function getAnalyticsIdentity(): string | null {
  return currentUserId;
}

/**
 * Client-side event. Safe to call in event handlers and effects.
 * No-op on the server — Vercel's client `track()` pushes to `window.vaq`,
 * which doesn't exist during SSR.
 *
 * Auto-stamps `user_id` when identity is set. Never throws; logs once to
 * console in dev if vendor call blows up so a broken analytics path never
 * takes down a user-facing handler.
 */
export function track<N extends EventName>(
  name: N,
  props: PropsFor<N>,
): void {
  if (typeof window === "undefined") return;
  try {
    const enriched: Record<string, string | number | boolean | null> = {
      ...(props as Record<string, string | number | boolean | null>),
    };
    if (currentUserId && !("user_id" in enriched)) {
      enriched.user_id = currentUserId;
    }
    vercelTrackClient(name, enriched);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] client track failed", name, err);
    }
  }
}

/**
 * Server-side event. Use inside server actions, route handlers, and
 * server components. Pass `userId` explicitly — the client ref is not
 * shared across environments.
 *
 * Fire-and-forget: returns a promise but we don't recommend awaiting it
 * on hot paths. Errors are swallowed (Vercel rate-limits / outages must
 * never break a publish or an RSVP).
 */
export async function trackServer<N extends EventName>(
  name: N,
  props: PropsFor<N>,
  userId: string | null,
): Promise<void> {
  try {
    const enriched: Record<string, string | number | boolean | null> = {
      ...(props as Record<string, string | number | boolean | null>),
    };
    if (userId && !("user_id" in enriched)) {
      enriched.user_id = userId;
    }
    await vercelTrackServer(name, enriched);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] server track failed", name, err);
    }
  }
}
