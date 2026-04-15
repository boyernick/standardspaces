"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { CITIES } from "@/lib/cities";
import { approveApplication } from "@/app/actions/applicationDecision";
import { sendSms } from "@/lib/twilio-sms";
import { applyLimit, otpLimit } from "@/lib/ratelimit";
import { Resend } from "resend";

const NOTIFY_EMAIL = "nickboyer.bizz@gmail.com";

// Validation constants shared with the form.
const NAME_MAX = 80;
const INSTAGRAM_RE = /^[A-Za-z0-9_.]{1,30}$/;
const PHONE_RE = /^\+[1-9]\d{9,14}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const CITY_NAMES: string[] = CITIES.map((c) => c.name);

/**
 * Called from the apply form before sending the OTP. Returns a single bit —
 * "can this phone apply?" — to avoid leaking whether the phone is approved
 * vs pending. Any existing application (regardless of status) returns false.
 */
export async function checkApplicationByPhone(phone: string): Promise<
  { canApply: boolean }
> {
  if (!phone.trim()) return { canApply: true };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applications")
    .select("id")
    .eq("phone", phone.trim())
    .single();
  return { canApply: !data };
}

/**
 * Rate-limit gate for "send apply OTP". The apply form calls this before
 * triggering Supabase's client-side `signInWithOtp`, so we can reject obvious
 * abuse (scripts hammering one phone) before burning an SMS.
 */
export async function requestApplyOtp(phone: string): Promise<
  { allowed: true } | { allowed: false; error: string }
> {
  const { success } = otpLimit(phone.trim());
  if (!success) {
    return {
      allowed: false,
      error: "Too many attempts. Please wait a bit before trying again.",
    };
  }
  return { allowed: true };
}

function normalizeInstagram(raw: string): string {
  let v = raw.trim();
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  v = v.replace(/^@/, "");
  v = v.replace(/\/$/, "");
  return v;
}

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
  const firstName = formData.firstName.trim();
  const lastName = formData.lastName.trim();
  const instagram = normalizeInstagram(formData.instagram);
  const phone = formData.phone.trim();
  const city = formData.city.trim();
  const referralId = formData.referralId?.trim() || undefined;
  // Applicant-supplied referrer fields are ignored entirely when a referralId
  // is present — the link encodes the referral, and trusting client-side
  // overrides would let someone swap in arbitrary phones/names.
  const referredByName = referralId ? undefined : formData.referredByName?.trim() || undefined;
  const referredByPhone = referralId ? undefined : formData.referredByPhone?.trim() || undefined;

  if (!firstName || !lastName || !instagram || !phone) {
    return { error: "All fields are required." };
  }
  if (firstName.length > NAME_MAX || lastName.length > NAME_MAX) {
    return { error: "Name is too long." };
  }
  if (!INSTAGRAM_RE.test(instagram)) {
    return { error: "Enter a valid Instagram handle." };
  }
  if (!PHONE_RE.test(phone)) {
    return { error: "Enter a valid phone number." };
  }
  if (!CITY_NAMES.includes(city)) {
    return { error: "Pick a supported city." };
  }
  if (referralId && !UUID_RE.test(referralId)) {
    return { error: "Invalid referral link." };
  }

  // Per-IP rate limit on submissions.
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!applyLimit(ip).success) {
    return { error: "Too many submissions. Please try again later." };
  }

  const supabase = createAdminClient();

  // Duplicate guard.
  const { data: existing } = await supabase
    .from("applications")
    .select("id, status")
    .eq("phone", phone)
    .single();

  if (existing) {
    if (existing.status === "approved") {
      return { error: "You've already been approved! Log in instead." };
    }
    return { error: "You've already applied. We'll text you when you're approved." };
  }

  const applicationData: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    instagram,
    phone,
    city: city || "Miami",
  };

  if (referredByName) applicationData.referred_by_name = referredByName;
  if (referredByPhone) applicationData.referred_by_phone = referredByPhone;

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
    console.error("submitApplication: insert failed", insertError);
    return { error: "Something went wrong. Please try again." };
  }

  let autoApproved = false;

  if (referralId) {
    // Link the referral row and, if the applicant's phone + first name match
    // what the referrer specified, short-circuit to auto-approval.
    const { data: referral } = await supabase
      .from("referrals")
      .select("id, referred_name, referred_phone")
      .eq("id", referralId)
      .single();

    if (referral) {
      await supabase
        .from("referrals")
        .update({ application_id: inserted.id, status: "pending_approval" })
        .eq("id", referralId);

      const refFirstName = (referral.referred_name || "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      const phoneMatch = referral.referred_phone === phone;
      const nameMatch = refFirstName !== "" && refFirstName === firstName.toLowerCase();

      if (phoneMatch && nameMatch) {
        const result = await approveApplication(inserted.id);
        if ("ok" in result) autoApproved = true;
        else console.error("submitApplication: auto-approve failed", result.error);
      } else {
        await notifyReferrerBySms(supabase, referralId, firstName);
      }
    }
  } else if (referredByPhone) {
    // Applicant-initiated: look up the referrer by phone in profiles.
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", referredByPhone)
      .single();

    if (referrerProfile) {
      const { data: newReferral } = await supabase
        .from("referrals")
        .insert({
          referrer_user_id: referrerProfile.id,
          referred_name: `${firstName} ${lastName}`,
          referred_phone: phone,
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

        await sendReferrerNotificationSms(referredByPhone, firstName);
      }
    }
  }

  // Notify admin via email. Best-effort; log failure with the application id.
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const referralLine = referredByName
        ? `<p style="color: #666;">Referred by: ${referredByName}${referredByPhone ? ` (${referredByPhone})` : ""}</p>`
        : "";
      await resend.emails.send({
        from: "Standard Spaces <onboarding@resend.dev>",
        to: NOTIFY_EMAIL,
        subject: `New application: ${firstName} ${lastName} (${city})`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px;">
            <h2 style="margin: 0 0 8px;">New membership application</h2>
            <p><strong>${firstName} ${lastName}</strong></p>
            <p style="color: #666;">${phone}</p>
            <p style="color: #666;">@${instagram}</p>
            <p style="color: #666;">City: ${city}</p>
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
  } catch (err) {
    console.error("submitApplication: admin notification failed", {
      applicationId: inserted.id,
      err,
    });
  }

  return { success: true, autoApproved };
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thestandardspaces.com";
  await sendSms(
    referrerPhone,
    `${applicantFirstName} applied to Standard Spaces and listed you as a reference. Approve or deny: ${siteUrl}/referrals`,
  );
}
