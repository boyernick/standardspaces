"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleSave(spotId: string): Promise<{ saved: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false };
  }

  // Check if already saved
  const { data: existing } = await supabase
    .from("user_saves")
    .select("id")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .single();

  if (existing) {
    await supabase
      .from("user_saves")
      .delete()
      .eq("user_id", user.id)
      .eq("spot_id", spotId);
    return { saved: false };
  }

  await supabase
    .from("user_saves")
    .insert({ user_id: user.id, spot_id: spotId });
  return { saved: true };
}

export async function getUserSaves(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("user_saves")
    .select("spot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => r.spot_id);
}

export async function checkIn(spotId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false };

  await supabase
    .from("user_checkins")
    .insert({ user_id: user.id, spot_id: spotId });

  return { success: true };
}

export async function getCheckinCount(spotId: string): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("user_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("spot_id", spotId);

  return count ?? 0;
}
