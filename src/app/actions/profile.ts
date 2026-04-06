"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getProfileStats(userId: string) {
  const supabase = await createClient();

  const [favorites, checkins, referrals, followers, following] = await Promise.all([
    supabase.from("user_favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_user_id", userId).eq("status", "approved"),
    supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  return {
    favorites: favorites.count ?? 0,
    checkins: checkins.count ?? 0,
    referrals: referrals.count ?? 0,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function getProfileById(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  bio?: string;
  instagram?: string;
  avatar_url?: string;
  city?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", user.id);

  if (error) return { error: "Failed to update profile" };
  return { success: true };
}

export async function completeOnboarding(data: {
  first_name?: string;
  last_name?: string;
  bio?: string;
  instagram?: string;
  avatar_url?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      ...data,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to complete onboarding" };
  return { success: true };
}

export async function updateNotificationPreferences(data: {
  sms_notifications: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ sms_notifications: data.sms_notifications })
    .eq("id", user.id);

  if (error) return { error: "Failed to update preferences" };
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Delete from auth.users (cascades to profiles via FK)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Failed to delete account" };

  // Sign out the current session
  await supabase.auth.signOut();
  return { success: true };
}
