"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { citySlugFromName } from "@/lib/cities";

/**
 * Canonicalize a URL for duplicate-detection compares. We normalize host
 * (lowercase + strip `www.`) and path (strip trailing slash), and drop
 * query + hash — different marketing/referrer tails on the same link
 * shouldn't read as different spaces. Returns null if the input can't
 * parse as a URL.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export type MyRecommendation = {
  id: string;
  url: string;
  additional_urls: string[];
  name: string | null;
  category: string | null;
  neighborhood: string | null;
  city: string;
  status: string;
  created_at: string;
  scraped_data: Record<string, unknown> | null;
  // Resolved server-side for published rows so the hub can deep-link to
  // the live space. Null for not-yet-published rows.
  spotId: string | null;
  citySlug: string | null;
};

/**
 * Member-facing list of the signed-in user's own recommendations. Not the
 * admin list — RLS scopes this to `user_id = auth.uid()`. The hub page at
 * /recommend buckets these by status into tabs (pending / approved /
 * denied). Status mapping:
 *
 *   - "pending" / "processing" / "scraped" / "failed" → Pending bucket
 *     (submission in flight or awaiting admin review)
 *   - "published"                                     → Approved bucket
 *   - "denied"                                        → Denied bucket
 *     (not yet emitted by the admin flow; tab renders empty today)
 */
export async function getMyRecommendations(): Promise<MyRecommendation[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "id, url, additional_urls, name, category, neighborhood, city, status, created_at, scraped_data",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyRecommendations: failed to load", error);
    return [];
  }

  const rows = (data ?? []) as Omit<MyRecommendation, "spotId" | "citySlug">[];

  // Resolve spot deep-links for published rows. Recommendations don't
  // carry a spot_id back-reference today, so we match URL → spots.website
  // (normalized) in a single query. Admin client because `spots` rows are
  // scoped by RLS and we only need id/website here.
  const published = rows.filter((r) => r.status === "published");
  const spotByNormalizedUrl = new Map<string, string>();
  if (published.length > 0) {
    const admin = createAdminClient();
    const { data: spotRows } = await admin
      .from("spots")
      .select("id, website");
    for (const s of spotRows ?? []) {
      const n = s.website ? normalizeUrl(s.website as string) : null;
      if (n) spotByNormalizedUrl.set(n, s.id as string);
    }
  }

  return rows.map((r) => {
    let spotId: string | null = null;
    if (r.status === "published") {
      const candidates = [r.url, ...(r.additional_urls ?? [])]
        .map(normalizeUrl)
        .filter((v): v is string => !!v);
      for (const c of candidates) {
        const hit = spotByNormalizedUrl.get(c);
        if (hit) {
          spotId = hit;
          break;
        }
      }
    }
    return {
      ...r,
      spotId,
      citySlug: spotId ? citySlugFromName(r.city) : null,
    };
  });
}

export type DuplicateCheckResult =
  | { kind: "none" }
  | {
      kind: "published";
      spot: {
        id: string;
        name: string;
        city: string;
        citySlug: string;
        neighborhood: string | null;
        category: string[] | null;
        image: string | null;
      };
    }
  | { kind: "pending"; mine: boolean };

/**
 * Duplicate-detection for a prospective recommendation. Returns whichever
 * of three states applies, in precedence order:
 *   1. The URL matches a live spot's `website` → `published` (user should
 *      just go to it).
 *   2. The URL matches any open recommendation (not yet published) →
 *      `pending` with `mine` flagging the caller's own previous submission.
 *   3. No match → `none`, caller proceeds with insert.
 *
 * Admin client because `spots` + others-recommendations aren't readable
 * via RLS from the anon context on submit.
 */
export async function checkDuplicateRecommendation(
  url: string,
  additionalUrls: string[] = [],
): Promise<DuplicateCheckResult> {
  const primary = normalizeUrl(url);
  if (!primary) return { kind: "none" };

  const candidates = new Set<string>([primary]);
  for (const extra of additionalUrls) {
    const n = normalizeUrl(extra);
    if (n) candidates.add(n);
  }
  const candidateList = [...candidates];

  const admin = createAdminClient();

  // 1) Live spots — compare normalized host+path against the spot's website.
  //    We pull the rows and match in JS so normalization stays in one place;
  //    dataset is small (tens of spots per city today).
  const { data: spotRows } = await admin
    .from("spots")
    .select("id, name, city, neighborhood, category, website, images");
  const spotHit = (spotRows ?? []).find((s) => {
    const n = s.website ? normalizeUrl(s.website as string) : null;
    return n && candidateList.includes(n);
  });
  if (spotHit) {
    const imagesRaw = spotHit.images;
    const firstImage = Array.isArray(imagesRaw) && imagesRaw.length > 0
      ? (imagesRaw[0] as string)
      : null;
    return {
      kind: "published",
      spot: {
        id: spotHit.id as string,
        name: spotHit.name as string,
        city: spotHit.city as string,
        citySlug: citySlugFromName(spotHit.city as string),
        neighborhood: (spotHit.neighborhood as string) ?? null,
        category: (spotHit.category as string[]) ?? null,
        image: firstImage,
      },
    };
  }

  // 2) Open recommendations — anything not yet published. Match against
  //    both `url` and any entry in `additional_urls`.
  const { data: recRows } = await admin
    .from("recommendations")
    .select("id, url, additional_urls, user_id, status")
    .neq("status", "published");
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const recHit = (recRows ?? []).find((r) => {
    const urls = [r.url as string, ...((r.additional_urls as string[]) ?? [])];
    return urls.some((u) => {
      const n = normalizeUrl(u);
      return n && candidateList.includes(n);
    });
  });
  if (recHit) {
    return { kind: "pending", mine: recHit.user_id === user?.id };
  }

  return { kind: "none" };
}

/**
 * Delete one of the caller's own recommendations. Only pending-bucket rows
 * are deletable (anything not yet `published`) — once a recommendation is
 * live in the guide it's tied to a spot and shouldn't vanish from here.
 *
 * Runs through the admin client after explicit ownership + status checks
 * because `recommendations` has no DELETE RLS policy; keeping deletion
 * server-side means we never have to loosen that.
 */
export async function deleteRecommendation(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from("recommendations")
    .select("id, user_id, status")
    .eq("id", id)
    .single();
  if (readErr || !row) return { error: "Recommendation not found" };
  if (row.user_id !== user.id) return { error: "Not your recommendation" };
  if (row.status === "published") {
    return { error: "Published recommendations can't be deleted here" };
  }

  const { error: delErr } = await admin
    .from("recommendations")
    .delete()
    .eq("id", id);
  if (delErr) return { error: "Couldn't delete. Try again." };

  revalidatePath("/recommend");
  return {};
}
