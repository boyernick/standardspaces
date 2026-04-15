import type { NextConfig } from "next";

/**
 * Conservative security headers. No CSP yet — Mapbox, Supabase, Google
 * Places, and a handful of inline scripts (theme init) make a strict
 * policy non-trivial, and a half-right CSP is worse than none. Add that
 * in a focused pass once Sentry is capturing violations.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  images: {
    remotePatterns: [
      // Supabase storage — user uploads (avatars, spot photos, event covers).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Google Places photos served via lh3. Ephemeral URLs, but we copy
      // to our bucket on publish; left here for pre-publish previews.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Generic image CDN hosts we've linked to in older listings.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
