import * as cheerio from "cheerio";

export interface ScrapedData {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  priceRange?: string;
  imageUrls: string[];
  instagram?: string;
  lat?: number;
  lng?: number;
}

// Follow redirects and get final URL + HTML
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  const html = await res.text();
  return { html, finalUrl: res.url };
}

// Extract Open Graph and meta tags
function extractMeta($: cheerio.CheerioAPI): Partial<ScrapedData> {
  const data: Partial<ScrapedData> = {};

  // OG tags
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");

  // Standard meta
  const metaDesc = $('meta[name="description"]').attr("content");
  const title = $("title").text();

  data.name = ogTitle || ogSiteName || title || undefined;
  data.description = ogDesc || metaDesc || undefined;

  // Clean name — remove " - Home", " | Restaurant", etc.
  if (data.name) {
    data.name = data.name.replace(/\s*[-|–—]\s*(Home|Official|Website|Restaurant|Bar|Cafe|Coffee|Hotel|Gym|Salon|Shop).*$/i, "").trim();
  }

  // Images — collect OG images, large images from page
  const imageUrls: string[] = [];
  if (ogImage) imageUrls.push(ogImage);

  // Additional OG images
  $('meta[property="og:image"]').each((_, el) => {
    const url = $(el).attr("content");
    if (url && !imageUrls.includes(url)) imageUrls.push(url);
  });

  // Twitter card images
  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  if (twitterImage && !imageUrls.includes(twitterImage)) imageUrls.push(twitterImage);

  // Large images from page (likely hero/gallery images)
  $("img").each((_, el) => {
    if (imageUrls.length >= 5) return false;
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;
    // Skip tiny images, icons, logos
    const width = parseInt($(el).attr("width") || "0");
    const height = parseInt($(el).attr("height") || "0");
    if ((width > 0 && width < 200) || (height > 0 && height < 200)) return;
    if (src.includes("logo") || src.includes("icon") || src.includes("favicon")) return;
    if (src.includes(".svg")) return;
    if (!imageUrls.includes(src)) imageUrls.push(src);
  });

  data.imageUrls = imageUrls.slice(0, 5);

  return data;
}

// Extract structured data (JSON-LD)
function extractJsonLd($: cheerio.CheerioAPI): Partial<ScrapedData> {
  const data: Partial<ScrapedData> = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        const type = item["@type"];
        if (!type) continue;

        // Restaurant, Bar, CafeOrCoffeeShop, Hotel, etc.
        if (typeof type === "string" && ["Restaurant", "BarOrPub", "CafeOrCoffeeShop", "Hotel", "HealthClub", "Store", "LocalBusiness", "FoodEstablishment"].includes(type)) {
          data.name = data.name || item.name;
          data.description = data.description || item.description;
          data.phone = data.phone || item.telephone;
          data.priceRange = data.priceRange || item.priceRange;

          if (item.address) {
            const addr = item.address;
            if (typeof addr === "string") {
              data.address = addr;
            } else {
              data.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", ");
            }
          }

          if (item.geo) {
            data.lat = parseFloat(item.geo.latitude);
            data.lng = parseFloat(item.geo.longitude);
          }

          if (item.openingHoursSpecification) {
            // Simplify to a readable string
            data.hours = Array.isArray(item.openingHoursSpecification)
              ? item.openingHoursSpecification.map((h: Record<string, string>) => `${h.dayOfWeek || ""} ${h.opens || ""}-${h.closes || ""}`).join(" · ")
              : undefined;
          }

          // Images from structured data
          if (item.image) {
            const images = Array.isArray(item.image) ? item.image : [item.image];
            for (const img of images) {
              const url = typeof img === "string" ? img : img?.url;
              if (url && !data.imageUrls?.includes(url)) {
                data.imageUrls = data.imageUrls || [];
                data.imageUrls.push(url);
              }
            }
          }
        }

        // Look for sameAs links (social profiles)
        if (item.sameAs) {
          const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
          for (const link of links) {
            if (typeof link === "string" && link.includes("instagram.com")) {
              const match = link.match(/instagram\.com\/([^/?]+)/);
              if (match) data.instagram = `@${match[1]}`;
            }
          }
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return data;
}

// Extract Instagram handle from page links
function extractInstagram($: cheerio.CheerioAPI): string | undefined {
  let handle: string | undefined;
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/instagram\.com\/([^/?]+)/);
      if (match && match[1] !== "p" && match[1] !== "reel") {
        handle = `@${match[1]}`;
        return false;
      }
    }
  });
  return handle;
}

// Main scrape function
export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const { html, finalUrl } = await fetchPage(url);
  const $ = cheerio.load(html);

  const meta = extractMeta($);
  const jsonLd = extractJsonLd($);
  const instagram = extractInstagram($);

  // Merge — JSON-LD takes priority, then meta, then extracted
  const result: ScrapedData = {
    name: jsonLd.name || meta.name,
    description: jsonLd.description || meta.description,
    address: jsonLd.address,
    phone: jsonLd.phone,
    website: finalUrl,
    hours: jsonLd.hours,
    priceRange: jsonLd.priceRange,
    imageUrls: [...new Set([...(jsonLd.imageUrls || []), ...(meta.imageUrls || [])])].slice(0, 5),
    instagram: jsonLd.instagram || instagram || meta.instagram,
    lat: jsonLd.lat,
    lng: jsonLd.lng,
  };

  return result;
}
