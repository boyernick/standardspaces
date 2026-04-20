"use server";

import { createClient } from "@/lib/supabase/server";

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
  return (data ?? []) as MyRecommendation[];
}
