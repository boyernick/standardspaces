import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  if (!phone) {
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
