import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeUrl } from "@/lib/scraper";
import { enrichScrapedData } from "@/lib/enrich";
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
    ({ recommendationId, url } = await req.json());

    if (!recommendationId || !url) {
      return NextResponse.json({ error: "Missing recommendationId or url" }, { status: 400 });
    }

    // Look up the previous scrape so we can reuse the cached Google place ID
    // (skips the text-search call on re-scrape) and the user's original city
    // hint (for locationBias when HTML has no coords yet).
    const { data: prevRec } = await supabase
      .from("recommendations")
      .select("scraped_data, city")
      .eq("id", recommendationId)
      .single();
    const prevScraped = (prevRec?.scraped_data ?? {}) as Record<string, unknown>;
    const knownPlaceId =
      typeof prevScraped.googlePlaceId === "string" ? prevScraped.googlePlaceId : undefined;
    const cityHint =
      typeof prevRec?.city === "string"
        ? prevRec.city
        : typeof prevScraped.city === "string"
          ? (prevScraped.city as string)
          : "Miami";

    // Scrape the new URL
    const initialScrape = await scrapeUrl(url, { city: cityHint, knownPlaceId });
    const scraped = await enrichScrapedData(initialScrape);

    // Download and upload photos
    const uploadedPhotos = await processPhotos(scraped.imageUrls, recommendationId);

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
      lat: scraped.lat || null,
      lng: scraped.lng || null,
      category: scraped.category || null,
      subcategory: scraped.subcategory || null,
      vibes: scraped.vibes || null,
      neighborhood: scraped.neighborhood || null,
      googlePlaceId: scraped.googlePlaceId || knownPlaceId || null,
    };

    // Update the recommendation with new scraped data
    await supabase
      .from("recommendations")
      .update({
        url,
        scraped_data: mergedData,
        scraped_images: uploadedPhotos,
        name: mergedData.name,
        status: "scraped",
        processed_at: new Date().toISOString(),
      })
      .eq("id", recommendationId);

    return NextResponse.json({
      success: true,
      data: mergedData,
      photos: uploadedPhotos,
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
