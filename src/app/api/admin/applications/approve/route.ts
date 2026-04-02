import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get application
    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Update status
    await supabase
      .from("applications")
      .update({ status: "approved" })
      .eq("id", applicationId);

    // Generate magic link for the user
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: app.email,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (linkError) {
      console.error("Error generating magic link:", linkError);
      return NextResponse.json({ error: "Failed to generate invite link" }, { status: 500 });
    }

    // Send invite email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && linkData?.properties?.action_link) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "Standard Spaces <onboarding@resend.dev>",
        to: app.email,
        subject: "You're in — Welcome to Standard Spaces",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px;">
            <h2 style="margin: 0 0 8px;">Welcome to Standard Spaces</h2>
            <p style="color: #666; margin: 0 0 16px;">
              Hi ${app.name}, your application has been approved.
            </p>
            <p style="margin: 0 0 24px;">
              <a href="${linkData.properties.action_link}"
                 style="display: inline-block; padding: 10px 24px; background: #6A001E; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Enter Standard Spaces
              </a>
            </p>
            <p style="color: #999; font-size: 13px;">
              This link expires in 24 hours. After your first login, you can request a new link anytime.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
