import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const recommendationId = formData.get("recommendationId") as string | null;

    if (!file || !recommendationId) {
      return NextResponse.json({ error: "Missing file or recommendationId" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const path = `recommendations/${recommendationId}/${Date.now()}.${ext}`;

    const supabase = createAdminClient();

    const { error } = await supabase.storage
      .from("spot-photos")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data } = supabase.storage
      .from("spot-photos")
      .getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
