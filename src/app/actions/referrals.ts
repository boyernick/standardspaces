"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import twilio from "twilio";

export async function getReferrals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("referrals")
    .select("*, applications(first_name, last_name, instagram, city)")
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getPendingReferralCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_user_id", user.id)
    .eq("status", "pending_approval");

  return count || 0;
}

export async function approveReferral(referralId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, application_id")
    .eq("id", referralId)
    .eq("referrer_user_id", user.id)
    .single();

  if (!referral) return { error: "Referral not found" };

  // Update referral status
  const { error: updateError } = await supabase
    .from("referrals")
    .update({ status: "approved" })
    .eq("id", referralId);

  if (updateError) return { error: "Failed to update referral" };

  // Update application referral_status if linked
  if (referral.application_id) {
    const admin = createAdminClient();
    await admin
      .from("applications")
      .update({ referral_status: "approved" })
      .eq("id", referral.application_id);
  }

  return { success: true };
}

export async function denyReferral(referralId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, application_id")
    .eq("id", referralId)
    .eq("referrer_user_id", user.id)
    .single();

  if (!referral) return { error: "Referral not found" };

  const { error: updateError } = await supabase
    .from("referrals")
    .update({ status: "denied" })
    .eq("id", referralId);

  if (updateError) return { error: "Failed to update referral" };

  if (referral.application_id) {
    const admin = createAdminClient();
    await admin
      .from("applications")
      .update({ referral_status: "denied" })
      .eq("id", referral.application_id);
  }

  return { success: true };
}

export async function submitReferral(formData: {
  name: string;
  phone: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { name, phone } = formData;
  if (!name.trim() || !phone.trim()) {
    return { error: "Name and phone are required." };
  }

  // Get referrer's profile for the SMS message
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .single();

  // Get referrer's name from their application
  const admin = createAdminClient();
  const { data: referrerApp } = await admin
    .from("applications")
    .select("first_name")
    .eq("phone", profile?.phone)
    .single();

  const referrerName = referrerApp?.first_name || "A member";

  // Create the referral row
  const { data: referral, error: insertError } = await supabase
    .from("referrals")
    .insert({
      referrer_user_id: user.id,
      referred_name: name.trim(),
      referred_phone: phone.trim(),
      status: "pending_apply",
    })
    .select("id")
    .single();

  if (insertError || !referral) {
    return { error: "Something went wrong. Please try again." };
  }

  // Send invite SMS via Twilio
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thestandardspaces.com";

    if (accountSid && authToken && messagingServiceSid) {
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: `${referrerName} invited you to join Standard Spaces. Apply here: ${siteUrl}/apply?ref=${referral.id}`,
        messagingServiceSid,
        to: phone.trim(),
      });
    }
  } catch (smsErr) {
    console.error("Failed to send referral invite SMS:", smsErr);
  }

  return { success: true };
}
