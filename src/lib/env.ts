/**
 * Runtime env validation. Import this at least once from a module that
 * runs at boot (root layout does the job) and the server will refuse to
 * start with a clear error if a required var is missing, instead of
 * failing deep in a request handler with an opaque `undefined`.
 *
 * Client-only usage should continue to read `process.env.NEXT_PUBLIC_*`
 * directly — Next inlines those at build time, they're not on the
 * server `process.env` at runtime in every codepath.
 */

type Scope = "server" | "public";

const SERVER_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "GOOGLE_PLACES_API_KEY",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
] as const;

const PUBLIC_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
] as const;

function assertEnv(scope: Scope, keys: readonly string[]) {
  const missing = keys.filter((k) => !process.env[k] || process.env[k] === "");
  if (missing.length === 0) return;
  const msg =
    `Missing required ${scope} env vars: ${missing.join(", ")}.\n` +
    `Set them in .env.local (dev) or the Vercel project settings (prod). ` +
    `See .env.example for the full list.`;
  // Warn, don't throw. A missing var should 500 the one handler that
  // actually needs it (e.g. /api/send-otp without Twilio creds), not
  // brick every page because the root layout imports this module. We
  // learned this the hard way: a hard throw here crashed the whole site
  // when one var wasn't set on Vercel.
  console.warn(`[env] ${msg}`);
}

// Guard: only run on the server. The `typeof window` check is eliminated
// by the bundler on the client, so this file has zero runtime cost in the
// browser bundle.
if (typeof window === "undefined") {
  assertEnv("server", SERVER_REQUIRED);
}

// Exposed for explicit callers (e.g. middleware) that want to validate
// just the public subset.
export function assertPublicEnv() {
  assertEnv("public", PUBLIC_REQUIRED);
}

export {};
