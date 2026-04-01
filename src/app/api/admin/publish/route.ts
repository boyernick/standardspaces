import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { geocodeAddress } from "@/lib/geocode";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { recommendationId, spot } = await req.json();

    if (!recommendationId || !spot) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Geocode the address if coordinates look like defaults
    let { lng, lat } = spot;
    if (spot.address && (lng === -80.19 || lat === 25.77 || !lng || !lat)) {
      const geo = await geocodeAddress(spot.address);
      if (geo) {
        lng = geo.lng;
        lat = geo.lat;
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
        images: spot.images || [],
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
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: `Failed to create spot: ${insertError.message}` }, { status: 500 });
    }

    await supabase
      .from("recommendations")
      .update({ status: "published" })
      .eq("id", recommendationId);

    return NextResponse.json({ success: true, spotId: spot.id });
  } catch (err) {
    console.error("Publish error:", err);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
