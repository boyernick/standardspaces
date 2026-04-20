"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendSms } from "@/lib/twilio-sms";

/**
 * Approve an application. Flips status, updates the linked referral (if any),
 * notifies the referrer in-app, and texts the applicant a welcome. Best-effort
 * on notifications — never throws from those paths.
 *
 * Returns { ok: true } on success or { error } if the application doesn't
 * exist or the status update fails.
 */
export async function approveApplication(
  applicationId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Application not found" };

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", applicationId);
  if (updateError) return { error: "Failed to update status" };

  // Update the linked referral row, if any, and notify the referrer.
  if (app.referral_id) {
    try {
      await supabase
        .from("referrals")
        .update({ status: "approved" })
        .eq("id", app.referral_id);

      const { data: ref } = await supabase
        .from("referrals")
        .select("referrer_user_id")
        .eq("id", app.referral_id)
        .single();
      if (ref?.referrer_user_id) {
        const fullName = `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() ||
          app.first_name ||
          "A new member";
        await createNotification({
          userId: ref.referrer_user_id,
          type: "referred_friend_joined",
          metadata: { name: fullName },
          dedupeKey: `referred_friend_joined:${applicationId}`,
        });
      }
    } catch (err) {
      console.error("approveApplication: referrer notification failed", err);
    }
  }

  await sendSms(
    app.phone,
    `Welcome to Standard Spaces, ${app.first_name}! You've been approved. Log in at thestandardspaces.com`,
  );

  return { ok: true };
}

/**
 * Reject an application. Flips status, marks the linked referral denied (if
 * any), and texts the applicant a soft denial. Best-effort SMS.
 */
export async function rejectApplication(
  applicationId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id, phone, referral_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Application not found" };

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId);
  if (updateError) return { error: "Failed to update status" };

  if (app.referral_id) {
    try {
      await supabase
        .from("referrals")
        .update({ status: "denied" })
        .eq("id", app.referral_id);
    } catch (err) {
      console.error("rejectApplication: referral update failed", err);
    }
  }

  await sendSms(
    app.phone,
    "Thanks for applying to Standard Spaces. We're not able to offer you membership at this time.",
  );

  return { ok: true };
}
