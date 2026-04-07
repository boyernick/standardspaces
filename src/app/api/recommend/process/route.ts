import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { scrapeUrl } from "@/lib/scraper";
import { enrichScrapedData } from "@/lib/enrich";
import { processPhotos } from "@/lib/photos";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const NOTIFY_EMAIL = "nickboyer.bizz@gmail.com";

async function sendNotification(data: {
  recommendationId: string;
  name: string;
  url: string;
  category?: string | null;
  neighborhood?: string | null;
  notes?: string | null;
  photos: number;
  siteUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Standard Spaces <onboarding@resend.dev>",
      to: NOTIFY_EMAIL,
      subject: `New recommendation: ${data.name}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px;">
          <h2 style="margin: 0 0 8px;">${data.name}</h2>
          <p style="color: #666; margin: 0 0 16px;">
            ${[data.category, data.neighborhood].filter(Boolean).join(" · ") || "No category/neighborhood provided"}
          </p>
          <p style="margin: 0 0 16px;">
            <a href="${data.url}" style="color: #FD5304;">${data.url}</a>
          </p>
          ${data.notes ? `<p style="color: #444; margin: 0 0 16px;"><em>"${data.notes}"</em></p>` : ""}
          <p style="color: #999; font-size: 13px;">
            ${data.photos} photo${data.photos !== 1 ? "s" : ""} scraped
          </p>
          <div style="margin: 20px 0;">
            <a href="${data.siteUrl}/admin/review/${data.recommendationId}"
               style="display: inline-block; padding: 10px 24px; background: #FD5304; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
              Review and publish
            </a>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const siteUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const supabase = createAdminClient();
    const { recommendationId } = await req.json();

    if (!recommendationId) {
      return NextResponse.json({ error: "Missing recommendationId" }, { status: 400 });
    }

    // Fetch the recommendation
    const { data: rec, error: fetchError } = await supabase
      .from("recommendations")
      .select("*")
      .eq("id", recommendationId)
      .single();

    if (fetchError || !rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    if (rec.status !== "pending") {
      return NextResponse.json({ error: "Already processed" }, { status: 400 });
    }

    // Update status to processing
    await supabase
      .from("recommendations")
      .update({ status: "processing" })
      .eq("id", recommendationId);

    // Scrape the URL
    const initialScrape = await scrapeUrl(rec.url);

    // Enrich with Google Places, Yelp, and Instagram data
    const scraped = await enrichScrapedData(initialScrape);

    // Download and upload photos to Supabase Storage
    const uploadedPhotos = await processPhotos(scraped.imageUrls, recommendationId);

    // Merge user-provided data with scraped data (user input takes priority)
    const mergedData = {
      name: rec.name || scraped.name || "Unknown",
      description: scraped.description || null,
      address: scraped.address || null,
      phone: scraped.phone || null,
      website: scraped.website || rec.url,
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
      category: rec.category || scraped.category || null,
      subcategory: scraped.subcategory || null,
      vibes: scraped.vibes || null,
      neighborhood: rec.neighborhood || scraped.neighborhood || null,
    };

    // Update the recommendation with scraped data
    const { error: updateError } = await supabase
      .from("recommendations")
      .update({
        scraped_data: mergedData,
        scraped_images: uploadedPhotos,
        status: "scraped",
        processed_at: new Date().toISOString(),
        name: mergedData.name,
      })
      .eq("id", recommendationId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to save scraped data" }, { status: 500 });
    }

    // Send email notification
    await sendNotification({
      recommendationId,
      name: mergedData.name,
      url: rec.url,
      category: mergedData.category,
      neighborhood: mergedData.neighborhood,
      notes: rec.notes,
      photos: uploadedPhotos.length,
      siteUrl,
    });

    return NextResponse.json({
      success: true,
      data: mergedData,
      photos: uploadedPhotos.length,
    });
  } catch (err) {
    console.error("Processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
