import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPhoneLimit } from "@/lib/ratelimit";

// E.164: +<country><number>, 7–15 digits. Reject anything else cheaply
// before touching the DB.
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

export async function POST(req: NextRequest) {
  // Per-IP rate limit to make phone-number enumeration noisy and slow.
  // In-memory only (see src/lib/ratelimit.ts) — swap to Upstash for
  // persistence across Vercel cold starts.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!checkPhoneLimit(ip).success) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const { phone } = await req.json();

  if (!phone || typeof phone !== "string" || !PHONE_RE.test(phone.trim())) {
    return NextResponse.json({ error: "Phone required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applications")
    .select("status")
    .eq("phone", phone.trim())
    .single();

  if (!data) {
    return NextResponse.json(
      { error: "No application found. Apply to join first." },
      { status: 403 }
    );
  }

  if (data.status !== "approved") {
    return NextResponse.json(
      { error: "Your application is still being reviewed." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
