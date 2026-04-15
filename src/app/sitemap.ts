import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://standardspaces.com";
  const now = new Date();

  // Only include publicly-accessible (non-auth-gated) routes. City / spot / event
  // pages sit behind requireAuth() so they can't be crawled meaningfully.
  const routes = ["", "/apply", "/login", "/refer", "/privacy", "/terms"];

  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
