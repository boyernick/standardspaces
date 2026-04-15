import { NextRequest, NextResponse } from "next/server";
import { approveApplication } from "@/app/actions/applicationDecision";

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }
    const result = await approveApplication(applicationId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
