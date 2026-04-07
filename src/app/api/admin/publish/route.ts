import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/geocode";
import { createNotification, fanOutNewSpotToCity } from "@/lib/notifications";

/**
 * Copy a batch of image URLs into a stable `spots/{spotId}/` subfolder of
 * the `spot-photos` bucket so that:
 *
 *  1. Deleting the source recommendation can't break the published spot.
 *  2. External/ephemeral URLs (Google `lh3.googleusercontent.com`, CDN
 *     short links) are replaced with URLs we own.
 *
 * Handling strategy per URL:
 *  - Already in `spot-photos/spots/{spotId}/...` → keep as-is.
 *  - In our bucket but a different path (e.g. `recommendations/{recId}/...`)
 *    → copy the object server-side.
 *  - External URL → download the bytes and upload.
 *  - Any failure on a given image → drop that one and continue (publish
 *    should never be blocked by a single broken image).
 */
async function persistImagesForSpot(
  imageUrls: string[],
  spotId: string,
): Promise<string[]> {
  const supabase = createAdminClient();
  const bucket = "spot-photos";
  const { data: publicBaseData } = supabase.storage.from(bucket).getPublicUrl("");
  const publicBase = publicBaseData.publicUrl.replace(/\/$/, "");

  const out: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    if (!url) continue;

    try {
      const destPath = `spots/${spotId}/${i}`;

      // Case 1: already in our bucket under spots/{spotId}/... → keep.
      if (url.startsWith(`${publicBase}/spots/${spotId}/`)) {
        out.push(url);
        continue;
      }

      // Case 2: in our bucket under a different path → server-side copy.
      if (url.startsWith(`${publicBase}/`)) {
        const srcPath = url.slice(publicBase.length + 1).split("?")[0];
        const ext = (srcPath.match(/\.([a-z0-9]+)$/i)?.[1] || "jpg").toLowerCase();
        const { error: copyErr } = await supabase.storage
          .from(bucket)
          .copy(srcPath, `${destPath}.${ext}`);
        if (copyErr && !/already exists/i.test(copyErr.message)) {
          console.warn("publish copy failed", srcPath, copyErr.message);
          continue;
        }
        const { data: pub } = supabase.storage
          .from(bucket)
          .getPublicUrl(`${destPath}.${ext}`);
        out.push(pub.publicUrl);
        continue;
      }

      // Case 3: external URL → download, upload.
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "image/*",
        },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 10000) continue; // skip icons/thumbnails

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(`${destPath}.${ext}`, buffer, { contentType, upsert: true });
      if (uploadErr) {
        console.warn("publish upload failed", uploadErr.message);
        continue;
      }
      const { data: pub } = supabase.storage
        .from(bucket)
        .getPublicUrl(`${destPath}.${ext}`);
      out.push(pub.publicUrl);
    } catch (err) {
      console.warn("publish image persist error", err);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { recommendationId, spot } = await req.json();

    if (!recommendationId || !spot) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Always try to geocode from address when coordinates are missing, zero,
    // or look like the placeholder default. Falling back to a neighborhood
    // query ("Brickell, Miami") ensures we never publish a spot at 0,0.
    let lng: number | null = typeof spot.lng === "number" ? spot.lng : null;
    let lat: number | null = typeof spot.lat === "number" ? spot.lat : null;
    const looksInvalid =
      lng === null ||
      lat === null ||
      lng === 0 ||
      lat === 0 ||
      lng === -80.19 ||
      lat === 25.77;
    if (looksInvalid) {
      const query =
        spot.address?.trim() ||
        [spot.neighborhood, spot.city].filter(Boolean).join(", ");
      if (query) {
        const geo = await geocodeAddress(query);
        if (geo) {
          lng = geo.lng;
          lat = geo.lat;
        }
      }
    }
    if (lng === 0 || lat === 0 || lng === null || lat === null) {
      return NextResponse.json(
        { error: "Unable to geocode address — please set a valid address before publishing." },
        { status: 400 },
      );
    }

    // Migrate any recommendation-scoped or external image URLs into a
    // stable `spots/{spotId}/` subfolder so the spot owns its photos.
    const rawImages: string[] = Array.isArray(spot.images) ? spot.images : [];
    const persistedImages = await persistImagesForSpot(rawImages, spot.id);

    // Resolve the Google place ID — either the form passed it through
    // explicitly or we pull it from the recommendation's scraped_data.
    let googlePlaceId: string | null =
      typeof spot.google_place_id === "string" && spot.google_place_id
        ? spot.google_place_id
        : typeof spot.googlePlaceId === "string" && spot.googlePlaceId
          ? spot.googlePlaceId
          : null;
    if (!googlePlaceId) {
      const { data: rec } = await supabase
        .from("recommendations")
        .select("scraped_data")
        .eq("id", recommendationId)
        .single();
      const scraped = (rec?.scraped_data ?? {}) as Record<string, unknown>;
      if (typeof scraped.googlePlaceId === "string") {
        googlePlaceId = scraped.googlePlaceId;
      }
    }

    const { error: insertError } = await supabase
      .from("spots")
      .insert({
        id: spot.id,
        name: spot.name,
        category: spot.category,
        subcategory: spot.subcategory,
        neighborhood: spot.neighborhood,
        city: spot.city,
        description: spot.description || "",
        address: spot.address || "",
        images: persistedImages,
        lng,
        lat,
        hours: spot.hours,
        phone: spot.phone,
        website: spot.website,
        instagram: spot.instagram,
        price_range: spot.price_range,
        dress_code: spot.dress_code,
        reservations: spot.reservations,
        parking: spot.parking,
        booking_url: spot.booking_url,
        menu_url: spot.menu_url,
        vibes: spot.vibes,
        google_place_id: googlePlaceId,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: `Failed to create spot: ${insertError.message}` }, { status: 500 });
    }

    await supabase
      .from("recommendations")
      .update({ status: "published" })
      .eq("id", recommendationId);

    // Notifications: submitter first (direct), then city-wide curation fan-out.
    try {
      const { data: recRow } = await supabase
        .from("recommendations")
        .select("user_id")
        .eq("id", recommendationId)
        .single();
      const submitterId =
        recRow && typeof recRow.user_id === "string" ? recRow.user_id : null;
      if (submitterId) {
        await createNotification({
          userId: submitterId,
          type: "recommendation_published",
          spotId: spot.id,
          recommendationId,
          metadata: { name: spot.name },
          dedupeKey: `recommendation_published:${recommendationId}`,
        });
      }
      if (spot.city) {
        await fanOutNewSpotToCity(spot.id, spot.city);
      }
    } catch (notifyErr) {
      console.error("publish notification fan-out failed:", notifyErr);
    }

    return NextResponse.json({ success: true, spotId: spot.id });
  } catch (err) {
    console.error("Publish error:", err);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
