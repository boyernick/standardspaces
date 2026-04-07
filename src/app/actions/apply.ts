"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import twilio from "twilio";

const NOTIFY_EMAIL = "nickboyer.bizz@gmail.com";

export async function submitApplication(formData: {
  firstName: string;
  lastName: string;
  instagram: string;
  phone: string;
  city: string;
  referredByName?: string;
  referredByPhone?: string;
  referralId?: string;
}) {
  const { firstName, lastName, instagram, phone, city, referredByName, referredByPhone, referralId } = formData;

  if (!firstName.trim() || !lastName.trim() || !instagram.trim() || !phone.trim()) {
    return { error: "All fields are required." };
  }

  const supabase = createAdminClient();

  // Check for duplicate
  const { data: existing } = await supabase
    .from("applications")
    .select("id, status")
    .eq("phone", phone.trim())
    .single();

  if (existing) {
    if (existing.status === "approved") {
      return { error: "You've already been approved! Log in instead." };
    }
    return { error: "You've already applied. We'll be in touch." };
  }

  // Build the insert payload
  const applicationData: Record<string, unknown> = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    instagram: instagram.trim().replace("@", ""),
    phone: phone.trim(),
    city: city.trim() || "Miami",
  };

  // If referral info provided (applicant-initiated or via ?ref= link)
  const refPhone = referredByPhone?.trim();
  const refName = referredByName?.trim();

  if (refName) applicationData.referred_by_name = refName;
  if (refPhone) applicationData.referred_by_phone = refPhone;

  // If coming from a proactive invite link (?ref=referralId)
  if (referralId) {
    applicationData.referral_id = referralId;
    applicationData.referral_status = "pending";
  }

  const { data: inserted, error: insertError } = await supabase
    .from("applications")
    .insert(applicationData)
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: "Something went wrong. Please try again." };
  }

  // Handle referral linking
  if (referralId) {
    // Proactive invite: link the application to the existing referral
    await supabase
      .from("referrals")
      .update({ application_id: inserted.id, status: "pending_approval" })
      .eq("id", referralId);

    // Send SMS to referrer notifying them to approve
    await notifyReferrerBySms(supabase, referralId, firstName.trim());
  } else if (refPhone) {
    // Applicant-initiated: look up referrer in profiles
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", refPhone)
      .single();

    if (referrerProfile) {
      // Create a referral row linked to this application
      const { data: newReferral } = await supabase
        .from("referrals")
        .insert({
          referrer_user_id: referrerProfile.id,
          referred_name: `${firstName.trim()} ${lastName.trim()}`,
          referred_phone: phone.trim(),
          application_id: inserted.id,
          status: "pending_approval",
        })
        .select("id")
        .single();

      if (newReferral) {
        await supabase
          .from("applications")
          .update({ referral_id: newReferral.id, referral_status: "pending" })
          .eq("id", inserted.id);

        // Notify the referrer via SMS
        await sendReferrerNotificationSms(refPhone, firstName.trim());
      }
    }
    // If referrer not found in profiles, the referred_by fields are still stored
    // on the application for admin visibility
  }

  // Notify admin via email
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const referralLine = refName
        ? `<p style="color: #666;">Referred by: ${refName}${refPhone ? ` (${refPhone})` : ""}</p>`
        : "";
      await resend.emails.send({
        from: "Standard Spaces <onboarding@resend.dev>",
        to: NOTIFY_EMAIL,
        subject: `New application: ${firstName.trim()} ${lastName.trim()} (${city.trim()})`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px;">
            <h2 style="margin: 0 0 8px;">New membership application</h2>
            <p><strong>${firstName.trim()} ${lastName.trim()}</strong></p>
            <p style="color: #666;">${phone.trim()}</p>
            <p style="color: #666;">@${instagram.trim().replace("@", "")}</p>
            <p style="color: #666;">City: ${city.trim()}</p>
            ${referralLine}
            <p style="margin-top: 16px;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/applications" style="color: #FD5304; font-weight: 500;">
                Review applications &rarr;
              </a>
            </p>
          </div>
        `,
      });
    }
  } catch {
    // Don't fail the application if email fails
  }

  return { success: true };
}

async function notifyReferrerBySms(
  supabase: ReturnType<typeof createAdminClient>,
  referralId: string,
  applicantFirstName: string,
) {
  const { data: referral } = await supabase
    .from("referrals")
    .select("referrer_user_id")
    .eq("id", referralId)
    .single();

  if (!referral) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, sms_notifications")
    .eq("id", referral.referrer_user_id)
    .single();

  if (profile?.phone && profile.sms_notifications !== false) {
    await sendReferrerNotificationSms(profile.phone, applicantFirstName);
  }
}

async function sendReferrerNotificationSms(referrerPhone: string, applicantFirstName: string) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thestandardspaces.com";

    if (accountSid && authToken && messagingServiceSid) {
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: `${applicantFirstName} applied to Standard Spaces and listed you as a reference. Approve or deny: ${siteUrl}/referrals`,
        messagingServiceSid,
        to: referrerPhone,
      });
    }
  } catch (err) {
    console.error("Failed to send referrer notification SMS:", err);
  }
}
