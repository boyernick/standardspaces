import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { researchVenue } from "@/lib/research";
import { extractImagesFromUrl } from "@/lib/image-scraper";
import { fetchGooglePlacesPhotos } from "@/lib/google-places";
import { processPhotos } from "@/lib/photos";
import { requireAdminApi } from "@/lib/auth";

/**
 * Re-scrape a published spot from a source URL. Mirrors
 * /api/admin/rescrape but targets the `spots` table — used from the
 * admin edit-listing form to refresh a listing's scraped fields + photos
 * without going through the recommendations staging flow.
 *
 * Locked photos in `spots.locked_images` (and any extra array the client
 * sends) are preserved at the front of the merged photo list. We don't
 * write the scraped fields back to the DB here — the admin reviews the
 * form, then clicks Save to persist, so a bad scrape can be discarded
 * by navigating away.
 */
export async function POST(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
  try {
    const body = await req.json();
    const { spotId, url, lockedImages } = body as {
      spotId?: string;
      url?: string;
      lockedImages?: unknown;
    };

    if (!spotId || !url) {
      return NextResponse.json(
        { error: "Missing spotId or url" },
        { status: 400 },
      );
    }

    const sanitizedLocked = Array.isArray(lockedImages)
      ? lockedImages.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        )
      : [];

    const supabase = createAdminClient();

    // City hint anchors the scraper's neighborhood/address inference when
    // the URL alone isn't geographic enough. Name hint helps Google
    // Places disambiguate when the scrape hasn't returned one yet.
    const { data: prevSpot } = await supabase
      .from("spots")
      .select("city, name")
      .eq("id", spotId)
      .single();
    const cityHint =
      typeof prevSpot?.city === "string" ? prevSpot.city : "Miami";
    const knownName =
      typeof prevSpot?.name === "string" && prevSpot.name.length > 0
        ? prevSpot.name
        : undefined;

    const [research, imageUrls] = await Promise.all([
      researchVenue(url, { city: cityHint, knownName }),
      extractImagesFromUrl(url),
    ]);
    const scraped = research.data;

    const placesQuery = [scraped.name || knownName, scraped.address, cityHint]
      .filter(Boolean)
      .join(" ");
    const places = placesQuery
      ? await fetchGooglePlacesPhotos(placesQuery).catch(() => null)
      : null;

    const combinedImageUrls = Array.from(
      new Set([
        ...(places?.imageUrls ?? []),
        ...imageUrls,
        ...(scraped.imageUrls ?? []),
      ]),
    );

    const uploadedPhotos = await processPhotos(combinedImageUrls, {
      kind: "spot",
      id: spotId,
    });

    // Locked first so they keep prime ordering (hero image stays hero).
    const mergedPhotos = Array.from(
      new Set([...sanitizedLocked, ...uploadedPhotos]),
    );

    const data = {
      name: scraped.name || knownName || "",
      description: scraped.description || null,
      address: scraped.address || null,
      phone: scraped.phone || null,
      website: scraped.website || url,
      hours: scraped.hours || null,
      priceRange: scraped.priceRange || null,
      dressCode: scraped.dressCode || null,
      parking: scraped.parking || null,
      bookingUrl: scraped.bookingUrl || null,
      bookingPlatform: scraped.bookingPlatform || null,
      menuUrl: scraped.menuUrl || null,
      instagram: scraped.instagram || null,
      category: scraped.category || null,
      subcategory: scraped.subcategory || null,
      vibes: scraped.vibes || null,
      neighborhood: scraped.neighborhood || null,
    };

    return NextResponse.json({
      success: true,
      data,
      photos: mergedPhotos,
    });
  } catch (err) {
    console.error("Re-scrape spot error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Re-scrape failed", detail: message },
      { status: 500 },
    );
  }
}
