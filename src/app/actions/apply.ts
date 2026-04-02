"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const NOTIFY_EMAIL = "nickboyer.bizz@gmail.com";

export async function submitApplication(formData: {
  name: string;
  email: string;
  instagram: string;
  reason: string;
  referral: string;
}) {
  const { name, email, instagram, reason, referral } = formData;

  if (!name.trim() || !email.trim()) {
    return { error: "Name and email are required." };
  }

  const supabase = createAdminClient();

  // Check for duplicate
  const { data: existing } = await supabase
    .from("applications")
    .select("id, status")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (existing) {
    if (existing.status === "approved") {
      return { error: "You've already been approved! Log in instead." };
    }
    return { error: "You've already applied. We'll be in touch." };
  }

  const { error: insertError } = await supabase.from("applications").insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    instagram: instagram.trim() || null,
    reason: reason.trim() || null,
    referral: referral.trim() || null,
  });

  if (insertError) {
    return { error: "Something went wrong. Please try again." };
  }

  // Notify admin
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "Standard Spaces <onboarding@resend.dev>",
        to: NOTIFY_EMAIL,
        subject: `New application: ${name.trim()}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px;">
            <h2 style="margin: 0 0 8px;">New membership application</h2>
            <p><strong>${name.trim()}</strong></p>
            <p style="color: #666;">${email.toLowerCase().trim()}</p>
            ${instagram.trim() ? `<p style="color: #666;">@${instagram.trim().replace("@", "")}</p>` : ""}
            ${reason.trim() ? `<p style="color: #444; margin-top: 12px;"><em>"${reason.trim()}"</em></p>` : ""}
            ${referral.trim() ? `<p style="color: #999; font-size: 13px;">Referral: ${referral.trim()}</p>` : ""}
            <p style="margin-top: 16px;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/applications" style="color: #6A001E; font-weight: 500;">
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
