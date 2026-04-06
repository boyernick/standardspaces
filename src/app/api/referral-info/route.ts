import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const referralId = req.nextUrl.searchParams.get("id");
  if (!referralId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get referral and look up the referrer's name from their application
  const { data: referral } = await supabase
    .from("referrals")
    .select("referrer_user_id, referred_name")
    .eq("id", referralId)
    .single();

  if (!referral) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get referrer's profile phone, then look up their name from applications
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", referral.referrer_user_id)
    .single();

  let referrerName = "A member";
  if (profile?.phone) {
    const { data: app } = await supabase
      .from("applications")
      .select("first_name")
      .eq("phone", profile.phone)
      .single();
    if (app?.first_name) {
      referrerName = app.first_name;
    }
  }

  return NextResponse.json({ referrerName });
}
