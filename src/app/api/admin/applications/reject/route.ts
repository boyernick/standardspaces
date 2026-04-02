import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("applications")
      .update({ status: "rejected" })
      .eq("id", applicationId);

    if (error) {
      return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reject error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
