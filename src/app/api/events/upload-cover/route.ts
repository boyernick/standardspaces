import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// See upload-avatar/route.ts — derive from MIME, not filename.
const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });

    const ext = EXT_FOR_TYPE[file.type];
    const path = `${user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("events")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Cover upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("events").getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Cover upload error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
