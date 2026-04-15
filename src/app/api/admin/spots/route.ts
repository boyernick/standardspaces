import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedSpot, buildSpotCorpus } from "@/lib/embeddings";
import { requireAdminApi } from "@/lib/auth";

/** Fields that, when changed, require re-embedding. */
const EMBEDDING_FIELDS = [
  "name",
  "category",
  "subcategory",
  "vibes",
  "neighborhood",
  "city",
  "description",
] as const;

export async function PUT(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
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
      .select("id, city, name, category, subcategory, vibes, neighborhood, description, embedding_source")
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

    // Best-effort re-embed. Skip if none of the searchable fields changed
    // (saves an OpenAI call on logistics-only edits like hours or parking).
    const touchedSearchable = EMBEDDING_FIELDS.some((f) => f in updates);
    if (touchedSearchable && updated) {
      try {
        const nextCorpus = buildSpotCorpus({
          name: updated.name,
          category: updated.category,
          subcategory: updated.subcategory,
          vibes: updated.vibes,
          neighborhood: updated.neighborhood,
          city: updated.city,
          description: updated.description,
        });
        if (nextCorpus && nextCorpus !== updated.embedding_source) {
          const result = await embedSpot({
            name: updated.name,
            category: updated.category,
            subcategory: updated.subcategory,
            vibes: updated.vibes,
            neighborhood: updated.neighborhood,
            city: updated.city,
            description: updated.description,
          });
          if (result) {
            await supabase
              .from("spots")
              .update({
                embedding: result.embedding,
                embedding_source: result.source,
                embedding_updated_at: new Date().toISOString(),
              })
              .eq("id", id);
          }
        }
      } catch (embedErr) {
        console.error("edit re-embed failed:", embedErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/spots error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
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
