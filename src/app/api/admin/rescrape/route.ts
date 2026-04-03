import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeUrl } from "@/lib/scraper";
import { enrichScrapedData } from "@/lib/enrich";
import { processPhotos } from "@/lib/photos";

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { recommendationId, url } = await req.json();

    if (!recommendationId || !url) {
      return NextResponse.json({ error: "Missing recommendationId or url" }, { status: 400 });
    }

    // Scrape the new URL
    const initialScrape = await scrapeUrl(url);
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
    };

    // Update the recommendation with new scraped data
    await supabase
      .from("recommendations")
      .update({
        url,
        scraped_data: mergedData,
        scraped_images: uploadedPhotos,
        name: mergedData.name,
      })
      .eq("id", recommendationId);

    return NextResponse.json({
      success: true,
      data: mergedData,
      photos: uploadedPhotos,
    });
  } catch (err) {
    console.error("Re-scrape error:", err);
    return NextResponse.json({ error: "Re-scrape failed" }, { status: 500 });
  }
}
