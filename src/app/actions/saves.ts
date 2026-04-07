"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyFollowersOfCheckIn } from "@/lib/notifications";

// --- Favorites (heart) ---

export async function toggleFavorite(spotId: string): Promise<{ favorited: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { favorited: false };

  const { data: existing } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .single();

  if (existing) {
    await supabase.from("user_favorites").delete().eq("user_id", user.id).eq("spot_id", spotId);
    return { favorited: false };
  }

  await supabase.from("user_favorites").insert({ user_id: user.id, spot_id: spotId });
  return { favorited: true };
}

export async function getUserFavorites(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_favorites")
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => r.spot_id);
}

// --- Wishlist (bookmark) ---

export async function toggleWishlist(spotId: string): Promise<{ wishlisted: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { wishlisted: false };

  const { data: existing } = await supabase
    .from("user_wishlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .single();

  if (existing) {
    await supabase.from("user_wishlist").delete().eq("user_id", user.id).eq("spot_id", spotId);
    return { wishlisted: false };
  }

  await supabase.from("user_wishlist").insert({ user_id: user.id, spot_id: spotId });
  return { wishlisted: true };
}

export async function getUserWishlist(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_wishlist")
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => r.spot_id);
}

export async function moveWishlistToFavorite(spotId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  // Remove from wishlist
  await supabase.from("user_wishlist").delete().eq("user_id", user.id).eq("spot_id", spotId);
  // Add to favorites (ignore if already exists)
  await supabase.from("user_favorites").upsert({ user_id: user.id, spot_id: spotId }, { onConflict: "user_id,spot_id" });

  return { success: true };
}

// --- Check-ins ---

export async function checkIn(spotId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  await Promise.all([
    supabase.from("user_checkins").upsert(
      { user_id: user.id, spot_id: spotId },
      { onConflict: "user_id,spot_id" }
    ),
    supabase.from("user_wishlist").delete().eq("user_id", user.id).eq("spot_id", spotId),
  ]);
  // Fan-out to followers. Dedupe key is spot-scoped so a user re-checking
  // in at the same spot won't re-notify their followers.
  await notifyFollowersOfCheckIn(user.id, spotId);
  return { success: true };
}

export async function uncheckIn(spotId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  await supabase.from("user_checkins").delete().eq("user_id", user.id).eq("spot_id", spotId);
  return { success: true };
}
