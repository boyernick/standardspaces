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

/**
 * API-route variant of requireAdmin: returns `null` if the caller is an
 * admin, or a JSON Response (401/403) to return directly from the handler.
 * Pattern:
 *   const deny = await requireAdminApi();
 *   if (deny) return deny;
 */
export async function requireAdminApi() {
  const { NextResponse } = await import("next/server");
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
