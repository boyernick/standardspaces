import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Rejects malformed IDs before they hit the DB — cheap guard against
// naive enumeration with sequential/numeric IDs. Proper rate limiting
// to stop UUID scrapers is pending Upstash wiring.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Route is intentionally public — the apply page fetches it pre-auth
// so "<referrer> invited you" can render on the referral landing. It
// discloses only the referrer's first name (or "A member" fallback),
// never their phone, full name, or user id.
export async function GET(req: NextRequest) {
  const referralId = req.nextUrl.searchParams.get("id");
  if (!referralId || !UUID_RE.test(referralId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
