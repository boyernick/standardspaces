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
