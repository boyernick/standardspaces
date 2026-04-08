"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Total count of admin-review work waiting for attention:
 * - applications with status = "pending"
 * - recommendations that haven't been published yet (pending, processing,
 *   scraped, failed — anything not "published")
 *
 * Only returns a non-zero count for admins; non-admins always get 0 so the
 * Navbar doesn't leak a badge to members who can't act on it.
 */
export async function getAdminPendingCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return 0;

  const [apps, recs] = await Promise.all([
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("recommendations")
      .select("*", { count: "exact", head: true })
      .neq("status", "published"),
  ]);

  return (apps.count ?? 0) + (recs.count ?? 0);
}
