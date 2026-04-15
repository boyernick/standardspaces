import { NextRequest, NextResponse } from "next/server";
import { rejectApplication } from "@/app/actions/applicationDecision";
import { requireAdminApi } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }
    const result = await rejectApplication(applicationId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reject error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
