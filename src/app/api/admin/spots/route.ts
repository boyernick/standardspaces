import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(req: NextRequest) {
  try {
    const { id, updates } = await req.json();

    if (!id || !updates) {
      return NextResponse.json({ error: "Missing id or updates" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: updated, error } = await supabase
      .from("spots")
      .update(updates)
      .eq("id", id)
      .select("id, city")
      .single();

    if (error) {
      console.error("Update spot error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidate the statically-generated detail page and city index so
    // edits show up immediately instead of waiting for the next build.
    if (updated?.city) {
      revalidatePath(`/${updated.city}/${updated.id}`);
      revalidatePath(`/${updated.city}`);
    }
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/spots error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("spots")
      .select("city")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("spots")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete spot error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (existing?.city) {
      revalidatePath(`/${existing.city}/${id}`);
      revalidatePath(`/${existing.city}`);
    }
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/spots error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
