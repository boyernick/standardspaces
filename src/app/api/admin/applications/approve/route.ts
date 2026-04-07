import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import twilio from "twilio";

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

    // If this application came in through a referral, let the referrer know
    // their friend just joined. Swallow errors — approval must not be
    // blocked by a notification insert failure.
    try {
      if (app.referral_id) {
        const { data: ref } = await supabase
          .from("referrals")
          .select("referrer_user_id")
          .eq("id", app.referral_id)
          .single();
        if (ref?.referrer_user_id) {
          await createNotification({
            userId: ref.referrer_user_id,
            type: "referred_friend_joined",
            metadata: { name: app.first_name },
            dedupeKey: `referred_friend_joined:${applicationId}`,
          });
        }
      }
    } catch (notifyErr) {
      console.error("approve referral notification failed:", notifyErr);
    }

    // Send approval SMS via Twilio
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

      if (accountSid && authToken && messagingServiceSid) {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: `Welcome to Standard Spaces, ${app.first_name}! You've been approved. Log in at thestandardspaces.com`,
          messagingServiceSid,
          to: app.phone,
        });
      }
    } catch (smsErr) {
      console.error("Failed to send approval SMS:", smsErr);
      // Don't fail the approval if SMS fails
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
