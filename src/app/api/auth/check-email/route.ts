import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applications")
    .select("status")
    .eq("email", email.toLowerCase())
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
