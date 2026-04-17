"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { trackServer } from "@/lib/analytics";

export async function toggleFollow(targetUserId: string): Promise<{ following: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return { following: false };

  const { data: existing } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .single();

  if (existing) {
    await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    await trackServer("unfollow_user", { target_id: targetUserId }, user.id);
    return { following: false };
  }

  await supabase.from("user_follows").insert({ follower_id: user.id, following_id: targetUserId });
  // Notify the followed user. Dedupe on follower_id so re-follows don't spam.
  await createNotification({
    userId: targetUserId,
    type: "followed_you",
    actorId: user.id,
    dedupeKey: `follow:${user.id}`,
  });
  await trackServer("follow_user", { target_id: targetUserId }, user.id);
  return { following: true };
}

export async function getFollowStatus(targetUserId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .single();

  return !!data;
}

export type FollowListMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  city: string | null;
};

/**
 * Return the profiles that follow `userId` (their followers) or that
 * `userId` follows (their following), depending on `kind`. Ordered by
 * follow-time descending so newest connections surface first. Lazy-loaded
 * from the profile page's follower/following modal — we don't ship the
 * full list on first paint because most visitors never open it.
 */
export async function getFollowList(
  userId: string,
  kind: "followers" | "following",
): Promise<FollowListMember[]> {
  const supabase = await createClient();
  // `followers` = rows where this user is the target, read the `follower_id`.
  // `following` = rows where this user is the source, read the `following_id`.
  const matchColumn = kind === "followers" ? "following_id" : "follower_id";
  const joinColumn = kind === "followers" ? "follower_id" : "following_id";

  const { data: rows } = await supabase
    .from("user_follows")
    .select(`${joinColumn}, created_at`)
    .eq(matchColumn, userId)
    .order("created_at", { ascending: false });

  const ids = (rows ?? [])
    .map((r) => (r as Record<string, string>)[joinColumn])
    .filter(Boolean);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, city")
    .in("id", ids);

  // Preserve the follow-time ordering — `in()` doesn't guarantee row order,
  // so re-sort by the original id sequence.
  const order = new Map(ids.map((id, i) => [id, i]));
  return (profiles ?? [])
    .map((p) => p as FollowListMember)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
