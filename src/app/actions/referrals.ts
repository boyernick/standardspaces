"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio-sms";

export async function getReferrals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch referrals through the user-scoped client (RLS filters by referrer).
  // We deliberately don't embed `applications(...)` here — the applications
  // table has RLS enabled with no user policies (service-role only), which
  // can cause PostgREST embeds to fail or silently drop rows.
  const { data: referrals, error } = await supabase
    .from("referrals")
    .select("id, referred_name, referred_phone, status, created_at, application_id")
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getReferrals: failed to load referrals", error);
    return [];
  }
  if (!referrals || referrals.length === 0) return [];

  // Enrich any referrals that are linked to an application, using the
  // admin client since applications isn't readable by the member role.
  const appIds = referrals
    .map((r) => r.application_id)
    .filter((id): id is string => !!id);

  let appsById: Record<string, { first_name: string; last_name: string; instagram: string; city: string }> = {};
  if (appIds.length > 0) {
    const admin = createAdminClient();
    const { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, first_name, last_name, instagram, city")
      .in("id", appIds);

    if (appsError) {
      console.error("getReferrals: failed to load linked applications", appsError);
    } else if (apps) {
      appsById = Object.fromEntries(
        apps.map((a) => [a.id, {
          first_name: a.first_name,
          last_name: a.last_name,
          instagram: a.instagram,
          city: a.city,
        }]),
      );
    }
  }

  return referrals.map((r) => ({
    ...r,
    applications: r.application_id ? (appsById[r.application_id] ?? null) : null,
  }));
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

/**
 * Resolve the referrer's first name from their application via their
 * profile phone. Used to personalize the invite SMS. Falls back to
 * "A member" so we never block a send.
 */
async function resolveReferrerName(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .single();

  if (!profile?.phone) return "A member";

  const admin = createAdminClient();
  const { data: referrerApp } = await admin
    .from("applications")
    .select("first_name")
    .eq("phone", profile.phone)
    .single();

  return referrerApp?.first_name || "A member";
}

function buildInviteBody(referrerName: string, referralId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://standardspaces.com";
  return `${referrerName} invited you to join Standard Spaces. Apply here: ${siteUrl}/apply?ref=${referralId}`;
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

  const referrerName = await resolveReferrerName(user.id);

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

  // Send invite SMS via Twilio. `sendSms` logs its own warning on
  // missing creds or send errors. If it fails we roll back the
  // referral row — otherwise the referrer sees a ghost "Invite sent"
  // entry for a recipient who never received a link.
  const sent = await sendSms(phone.trim(), buildInviteBody(referrerName, referral.id));

  if (!sent) {
    const admin = createAdminClient();
    await admin.from("referrals").delete().eq("id", referral.id);
    return { error: "Couldn't send the invite text. Please try again shortly." };
  }

  return { success: true };
}

/**
 * Re-send the invite SMS for an existing pending_apply referral. Used
 * from the /referrals page when the original SMS failed or was missed.
 * Does NOT delete the row on failure — the referrer can try again.
 */
export async function resendReferralInvite(referralId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referred_phone, status")
    .eq("id", referralId)
    .eq("referrer_user_id", user.id)
    .single();

  if (!referral) return { error: "Referral not found" };
  if (referral.status !== "pending_apply") {
    return { error: "This referral has already progressed — nothing to resend." };
  }

  const referrerName = await resolveReferrerName(user.id);
  const sent = await sendSms(referral.referred_phone, buildInviteBody(referrerName, referral.id));

  if (!sent) {
    return { error: "Couldn't send the invite text. Please try again shortly." };
  }
  return { success: true };
}

/**
 * Hard-delete a referral. RLS + the ownership check keep users from
 * deleting anyone else's rows. Allowed on any status — the member can
 * decide a past referral shouldn't be in their list anymore.
 */
export async function deleteReferral(referralId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("referrals")
    .delete()
    .eq("id", referralId)
    .eq("referrer_user_id", user.id);

  if (error) {
    console.error("deleteReferral: failed", error);
    return { error: "Couldn't delete. Please try again." };
  }
  return { success: true };
}
