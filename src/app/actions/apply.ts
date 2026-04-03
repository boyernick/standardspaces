"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const NOTIFY_EMAIL = "nickboyer.bizz@gmail.com";

export async function submitApplication(formData: {
  firstName: string;
  lastName: string;
  instagram: string;
  phone: string;
  city: string;
}) {
  const { firstName, lastName, instagram, phone, city } = formData;

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

  const { error: insertError } = await supabase.from("applications").insert({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    instagram: instagram.trim().replace("@", ""),
    phone: phone.trim(),
    city: city.trim() || "Miami",
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
        subject: `New application: ${firstName.trim()} ${lastName.trim()} (${city.trim()})`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px;">
            <h2 style="margin: 0 0 8px;">New membership application</h2>
            <p><strong>${firstName.trim()} ${lastName.trim()}</strong></p>
            <p style="color: #666;">${phone.trim()}</p>
            <p style="color: #666;">@${instagram.trim().replace("@", "")}</p>
            <p style="color: #666;">City: ${city.trim()}</p>
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
