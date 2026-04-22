import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, city, sms_notifications, notification_prefs")
    .eq("id", user.id)
    .single();

  const defaultPrefs = { social: true, events: true, recommendations: true, curation: true };
  const notificationPrefs = { ...defaultPrefs, ...(profile?.notification_prefs ?? {}) };

  return (
    <PageShell navbar={<Navbar />} maxWidth="md">
      <SettingsClient
        phone={profile?.phone || ""}
        city={profile?.city || "Miami"}
        smsNotifications={profile?.sms_notifications ?? true}
        notificationPrefs={notificationPrefs}
      />
    </PageShell>
  );
}
