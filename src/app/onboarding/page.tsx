import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { citySlugFromName } from "@/lib/cities";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url, city, onboarded")
    .eq("id", user.id)
    .single();

  if (profile?.onboarded) {
    redirect(`/${citySlugFromName(profile.city || "Miami")}`);
  }

  return (
    <OnboardingClient
      profile={{
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        avatarUrl: profile?.avatar_url || "",
        city: profile?.city || "Miami",
      }}
    />
  );
}
