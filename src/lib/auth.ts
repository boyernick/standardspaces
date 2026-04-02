import { cache } from "react";
import { unauthorized, forbidden } from "next/navigation";
import { createClient } from "./supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});

export async function requireAuth() {
  const user = await getSession();
  if (!user) unauthorized();
  return user;
}

export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") forbidden();
  return profile;
}
