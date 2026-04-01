import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { recommendationId } = await req.json();

    if (!recommendationId) {
      return NextResponse.json({ error: "Missing recommendationId" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Delete uploaded photos from storage
    const { data: files } = await supabase.storage
      .from("spot-photos")
      .list(`recommendations/${recommendationId}`);

    if (files && files.length > 0) {
      await supabase.storage
        .from("spot-photos")
        .remove(files.map((f) => `recommendations/${recommendationId}/${f.name}`));
    }

    // Delete the recommendation record
    const { error } = await supabase
      .from("recommendations")
      .delete()
      .eq("id", recommendationId);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
