import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { researchVenue } from "@/lib/research";
import { extractImagesFromUrl } from "@/lib/image-scraper";
import { fetchGooglePlacesPhotos } from "@/lib/google-places";
import { processPhotos } from "@/lib/photos";
import { requireAdminApi } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const deny = await requireAdminApi();
  if (deny) return deny;
  // Hoisted so the outer catch can mark the row as failed.
  const supabase = createAdminClient();
  let recommendationId: string | undefined;
  try {
    let url: string | undefined;
    let lockedImages: string[] | undefined;
    ({ recommendationId, url, lockedImages } = await req.json());

    if (!recommendationId || !url) {
      return NextResponse.json({ error: "Missing recommendationId or url" }, { status: 400 });
    }

    const sanitizedLocked = Array.isArray(lockedImages)
      ? lockedImages.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];

    // Look up the previous scrape for the city hint (used to anchor
    // Perplexity's neighborhood/address inference when the URL alone isn't
    // geographic enough).
    const { data: prevRec } = await supabase
      .from("recommendations")
      .select("scraped_data, city, name")
      .eq("id", recommendationId)
      .single();
    const prevScraped = (prevRec?.scraped_data ?? {}) as Record<string, unknown>;
    const cityHint =
      typeof prevRec?.city === "string"
        ? prevRec.city
        : typeof prevScraped.city === "string"
          ? (prevScraped.city as string)
          : "Miami";
    const knownName =
      typeof prevRec?.name === "string" && prevRec.name.length > 0 ? prevRec.name : undefined;

    // Research + image extraction in parallel. See process route for rationale.
    const [research, imageUrls] = await Promise.all([
      researchVenue(url, { city: cityHint, knownName }),
      extractImagesFromUrl(url),
    ]);
    const scraped = research.data;

    // Google Places photos — sequential, after research, so we have the
    // name+address to build a strong text query. See process route for the
    // rationale on Places being our best image source.
    const placesQuery = [scraped.name || knownName, scraped.address, cityHint]
      .filter(Boolean)
      .join(" ");
    const places = placesQuery
      ? await fetchGooglePlacesPhotos(placesQuery).catch(() => null)
      : null;

    // Places first (highest quality), then on-site HTML, then Perplexity
    // fallbacks. Dedupe preserves order.
    const combinedImageUrls = Array.from(
      new Set([
        ...(places?.imageUrls ?? []),
        ...imageUrls,
        ...(scraped.imageUrls ?? []),
      ]),
    );

    // Download and upload photos
    const uploadedPhotos = await processPhotos(combinedImageUrls, recommendationId);

    // Preserve locked photos: prepend them to the uploaded list so they
    // keep their slots (and stay first for the primary cover). Dedupe in
    // case a locked URL also came back from the scrape.
    const mergedPhotos = Array.from(new Set([...sanitizedLocked, ...uploadedPhotos]));

    const mergedData = {
      name: scraped.name || "Unknown",
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
      // lat/lng intentionally omitted — research no longer produces
      // coordinates; publish geocodes from address.
      category: scraped.category || null,
      subcategory: scraped.subcategory || null,
      vibes: scraped.vibes || null,
      neighborhood: scraped.neighborhood || null,
      googlePlaceId: places?.placeId ?? null,
      sources: research.sources,
    };

    // Update the recommendation with new scraped data
    await supabase
      .from("recommendations")
      .update({
        url,
        scraped_data: mergedData,
        scraped_images: mergedPhotos,
        locked_images: sanitizedLocked,
        name: mergedData.name,
        status: "scraped",
        processed_at: new Date().toISOString(),
      })
      .eq("id", recommendationId);

    return NextResponse.json({
      success: true,
      data: mergedData,
      photos: mergedPhotos,
    });
  } catch (err) {
    console.error("Re-scrape error:", err);
    const message = err instanceof Error ? err.message : String(err);
    if (recommendationId) {
      try {
        await supabase
          .from("recommendations")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", recommendationId);
      } catch (updateErr) {
        console.error("Failed to mark recommendation as failed:", updateErr);
      }
    }
    return NextResponse.json(
      { error: "Re-scrape failed", detail: message },
      { status: 500 },
    );
  }
}
