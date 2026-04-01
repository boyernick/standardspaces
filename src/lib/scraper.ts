import * as cheerio from "cheerio";

export interface ScrapedData {
  name?: string;
  description?: string;
  address?: string;
  neighborhood?: string;
  phone?: string;
  website?: string;
  hours?: string;
  priceRange?: string;
  dressCode?: string;
  parking?: string;
  bookingUrl?: string;
  bookingPlatform?: string;
  imageUrls: string[];
  instagram?: string;
  lat?: number;
  lng?: number;
  subcategory?: string[];
  category?: string;
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
            data.hours = formatHoursSpec(item.openingHoursSpecification);
          } else if (item.openingHours) {
            // Some sites use the simpler openingHours string/array
            const oh = Array.isArray(item.openingHours) ? item.openingHours.join(" · ") : item.openingHours;
            if (typeof oh === "string") data.hours = data.hours || oh;
          }

          // Parking
          if (item.amenityFeature) {
            const amenities = Array.isArray(item.amenityFeature) ? item.amenityFeature : [item.amenityFeature];
            for (const a of amenities) {
              const aName = (a.name || a.value || "").toLowerCase();
              if (aName.includes("parking") || aName.includes("valet")) {
                data.parking = data.parking || a.name || a.value;
              }
            }
          }
          if (item.parking) {
            data.parking = data.parking || (typeof item.parking === "string" ? item.parking : undefined);
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

// Miami neighborhood inference from address
const MIAMI_NEIGHBORHOODS: { name: string; patterns: RegExp[] }[] = [
  { name: "Brickell", patterns: [/\bbrickell\b/i, /\bse\s+1(st|2nd|3rd)\s+st\b/i] },
  { name: "Wynwood", patterns: [/\bwynwood\b/i, /\bnw\s+2(nd|3rd|4th|5th)\s+ave\b.*\bnw\s+2[0-9]+(st|nd|rd|th)\s+st\b/i] },
  { name: "Design District", patterns: [/\bdesign\s*district\b/i, /\bne\s+3(8|9|40|41)(st|nd|rd|th)\s+st\b/i] },
  { name: "South Beach", patterns: [/\bsouth\s*beach\b/i, /\bocean\s*dr/i, /\bcollins\s*ave\b/i, /\bwashington\s*ave\b.*\bmiami\s*beach\b/i] },
  { name: "Miami Beach", patterns: [/\bmiami\s*beach\b/i] },
  { name: "Coral Gables", patterns: [/\bcoral\s*gables\b/i, /\bponce\s*de\s*leon\b/i, /\bmiracle\s*mile\b/i] },
  { name: "Coconut Grove", patterns: [/\bcoconut\s*grove\b/i, /\bcoco\s*walk\b/i] },
  { name: "Downtown", patterns: [/\bdowntown\s*miami\b/i, /\bflaglers?\s+st\b/i, /\bbiscayne\s*blvd\b.*\b33132\b/i] },
  { name: "Midtown", patterns: [/\bmidtown\b/i, /\bnorth\s*midtown\b/i] },
  { name: "Edgewater", patterns: [/\bedgewater\b/i, /\bnortheast\s+\d+.*\b33137\b/i] },
  { name: "Little Havana", patterns: [/\blittle\s*havana\b/i, /\bcalle\s*ocho\b/i, /\bsw\s+8th\s+st\b/i] },
  { name: "Aventura", patterns: [/\baventura\b/i] },
  { name: "Doral", patterns: [/\bdoral\b/i] },
  { name: "Key Biscayne", patterns: [/\bkey\s*biscayne\b/i] },
  { name: "Bal Harbour", patterns: [/\bbal\s*harbour\b/i] },
  { name: "Surfside", patterns: [/\bsurfside\b/i] },
  { name: "North Miami", patterns: [/\bnorth\s*miami\b/i] },
  { name: "Overtown", patterns: [/\bovertown\b/i] },
  { name: "Little River", patterns: [/\blittle\s*river\b/i] },
  { name: "Upper East Side", patterns: [/\bupper\s*east\s*side\b/i] },
];

// Zip code to neighborhood mapping for Miami
const MIAMI_ZIP_NEIGHBORHOODS: Record<string, string> = {
  "33129": "Brickell",
  "33130": "Brickell",
  "33131": "Brickell",
  "33127": "Wynwood",
  "33137": "Edgewater",
  "33132": "Downtown",
  "33128": "Downtown",
  "33133": "Coconut Grove",
  "33134": "Coral Gables",
  "33146": "Coral Gables",
  "33135": "Little Havana",
  "33136": "Overtown",
  "33138": "Upper East Side",
  "33139": "South Beach",
  "33140": "Miami Beach",
  "33141": "Miami Beach",
  "33154": "Bal Harbour",
  "33160": "North Miami",
  "33180": "Aventura",
  "33149": "Key Biscayne",
  "33166": "Doral",
  "33172": "Doral",
  "33143": "South Miami",
  "33156": "Pinecrest",
};

function inferNeighborhood(address?: string, description?: string): string | undefined {
  if (!address) return undefined;

  const combined = (address + " " + (description || "")).toLowerCase();

  // Try pattern matching first
  for (const { name, patterns } of MIAMI_NEIGHBORHOODS) {
    for (const p of patterns) {
      if (p.test(combined)) return name;
    }
  }

  // Try zip code
  const zipMatch = address.match(/\b(33\d{3})\b/);
  if (zipMatch && MIAMI_ZIP_NEIGHBORHOODS[zipMatch[1]]) {
    return MIAMI_ZIP_NEIGHBORHOODS[zipMatch[1]];
  }

  return undefined;
}

// Infer price range from category/subcategory context
function inferPriceRange(category?: string, subcategories?: string[]): string | undefined {
  const subs = subcategories || [];
  if (category === "dining") {
    if (subs.includes("Fine dining") || subs.includes("Omakase") || subs.includes("Tasting menu")) return "$$$$";
    return "$$$";
  }
  if (category === "drinks") {
    if (subs.includes("Speakeasy") || subs.includes("Lounge")) return "$$$";
    if (subs.includes("Nightclub")) return "$$$$";
    return "$$";
  }
  if (category === "hotels") return "$$$$";
  if (category === "wellness") {
    if (subs.includes("Spa")) return "$$$$";
    return "$$$";
  }
  if (category === "members") return "$$$$";
  if (category === "coffee") return "$$";
  if (category === "shopping") {
    if (subs.includes("Jewelry") || subs.includes("Watches")) return "$$$$";
    return "$$$";
  }
  return undefined;
}

// Infer dress code from category context
function inferDressCode(category?: string, subcategories?: string[]): string | undefined {
  const subs = subcategories || [];
  if (category === "dining") {
    if (subs.includes("Fine dining") || subs.includes("Omakase") || subs.includes("Tasting menu")) return "Smart casual";
    if (subs.includes("Brunch")) return "Casual";
    return "Smart casual";
  }
  if (category === "drinks") {
    if (subs.includes("Nightclub")) return "Upscale";
    if (subs.includes("Speakeasy") || subs.includes("Lounge")) return "Smart casual";
    return "Casual";
  }
  if (category === "hotels") return "Resort casual";
  if (category === "members") return "Smart casual";
  return undefined;
}

// Infer parking from address context
function inferParking(address?: string): string | undefined {
  if (!address) return undefined;
  const lc = address.toLowerCase();
  // Downtown/Brickell area — typically valet
  if (/brickell|downtown|33131|33132|33130|33129/.test(lc)) return "Valet available";
  // Beach areas
  if (/miami\s*beach|south\s*beach|collins|ocean\s*dr|33139|33140|33141/.test(lc)) return "Valet available";
  // Coral Gables
  if (/coral\s*gables|33134|33146/.test(lc)) return "Street parking";
  // Wynwood / Design District
  if (/wynwood|design\s*district|33127|33137/.test(lc)) return "Street parking";
  return undefined;
}

// Format openingHoursSpecification into a readable string
function formatHoursSpec(spec: unknown): string | undefined {
  if (!Array.isArray(spec)) return undefined;

  const dayAbbr: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
    Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
    "https://schema.org/Monday": "Mon", "https://schema.org/Tuesday": "Tue",
    "https://schema.org/Wednesday": "Wed", "https://schema.org/Thursday": "Thu",
    "https://schema.org/Friday": "Fri", "https://schema.org/Saturday": "Sat",
    "https://schema.org/Sunday": "Sun",
  };

  // Group entries by time range to compress output
  const grouped = new Map<string, string[]>();
  for (const h of spec) {
    const days = Array.isArray(h.dayOfWeek) ? h.dayOfWeek : [h.dayOfWeek];
    const time = `${h.opens || ""}–${h.closes || ""}`;
    for (const d of days) {
      const abbr = dayAbbr[d] || String(d).replace(/^https:\/\/schema\.org\//, "").slice(0, 3);
      if (!grouped.has(time)) grouped.set(time, []);
      grouped.get(time)!.push(abbr);
    }
  }

  const parts: string[] = [];
  for (const [time, days] of grouped) {
    if (days.length === 7) {
      parts.push(`Daily ${time}`);
    } else {
      parts.push(`${days.join(", ")} ${time}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

// Extract booking links (OpenTable, Resy, Tock, SevenRooms, Yelp Reservations)
function extractBookingLinks($: cheerio.CheerioAPI): { bookingUrl?: string; bookingPlatform?: string } {
  const platforms: { pattern: RegExp; name: string }[] = [
    { pattern: /opentable\.com/i, name: "OpenTable" },
    { pattern: /resy\.com/i, name: "Resy" },
    { pattern: /exploretock\.com/i, name: "Tock" },
    { pattern: /sevenrooms\.com/i, name: "SevenRooms" },
    { pattern: /yelp\.com\/reservations/i, name: "Yelp" },
  ];

  // Check all links on the page
  let bookingUrl: string | undefined;
  let bookingPlatform: string | undefined;

  $("a[href]").each((_, el) => {
    if (bookingUrl) return false;
    const href = $(el).attr("href");
    if (!href) return;
    for (const { pattern, name } of platforms) {
      if (pattern.test(href)) {
        bookingUrl = href;
        bookingPlatform = name;
        return false;
      }
    }
  });

  // Also check for reservation widgets / iframes
  if (!bookingUrl) {
    $("iframe[src], script[src]").each((_, el) => {
      if (bookingUrl) return false;
      const src = $(el).attr("src");
      if (!src) return;
      for (const { pattern, name } of platforms) {
        if (pattern.test(src)) {
          bookingUrl = src;
          bookingPlatform = name;
          return false;
        }
      }
    });
  }

  return { bookingUrl, bookingPlatform };
}

// Extract dress code, parking, and hours from page text content
function extractPageDetails($: cheerio.CheerioAPI): { dressCode?: string; parking?: string; hours?: string; priceRange?: string } {
  const result: { dressCode?: string; parking?: string; hours?: string; priceRange?: string } = {};
  const bodyText = $("body").text();

  // Dress code — look for common patterns
  const dressCodePatterns = [
    /dress\s*code\s*[:–—-]\s*([^\n.]{3,60})/i,
    /attire\s*[:–—-]\s*([^\n.]{3,60})/i,
  ];
  for (const p of dressCodePatterns) {
    const m = bodyText.match(p);
    if (m) {
      result.dressCode = m[1].trim();
      break;
    }
  }

  // Known dress code keywords in any text
  if (!result.dressCode) {
    const lcBody = bodyText.toLowerCase();
    if (lcBody.includes("smart casual")) result.dressCode = "Smart casual";
    else if (lcBody.includes("business casual")) result.dressCode = "Business casual";
    else if (lcBody.includes("cocktail attire")) result.dressCode = "Cocktail attire";
    else if (lcBody.includes("black tie")) result.dressCode = "Black tie";
    else if (lcBody.includes("resort casual")) result.dressCode = "Resort casual";
    else if (lcBody.includes("casual elegant")) result.dressCode = "Casual elegant";
  }

  // Parking — look for common patterns
  const parkingPatterns = [
    /parking\s*[:–—-]\s*([^\n.]{3,80})/i,
    /valet\s*(?:parking)?\s*[:–—-]\s*([^\n.]{3,80})/i,
  ];
  for (const p of parkingPatterns) {
    const m = bodyText.match(p);
    if (m) {
      result.parking = m[1].trim();
      break;
    }
  }

  if (!result.parking) {
    const lcBody = bodyText.toLowerCase();
    if (lcBody.includes("valet parking") || lcBody.includes("valet available")) result.parking = "Valet available";
    else if (lcBody.includes("complimentary valet")) result.parking = "Complimentary valet";
    else if (lcBody.includes("self-parking") || lcBody.includes("self parking")) result.parking = "Self-parking available";
    else if (lcBody.includes("street parking")) result.parking = "Street parking";
    else if (lcBody.includes("parking garage")) result.parking = "Parking garage";
  }

  // Price range — look for $ signs if not already found
  const priceMatch = bodyText.match(/price\s*(?:range)?\s*[:–—-]\s*(\${1,4})/i);
  if (priceMatch) result.priceRange = priceMatch[1];
  if (!result.priceRange) {
    // Count consecutive $ signs in description/meta areas
    const metaText = ($('meta[name="description"]').attr("content") || "") + " " + ($('meta[property="og:description"]').attr("content") || "");
    const dollarMatch = metaText.match(/(\${2,4})/);
    if (dollarMatch) result.priceRange = dollarMatch[1];
  }

  return result;
}

// Infer category and subcategories from scraped text and structured data
function inferSubcategories(data: Partial<ScrapedData>, $: cheerio.CheerioAPI): { category?: string; subcategory: string[] } {
  const text = [
    data.name,
    data.description,
    $('meta[property="og:title"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
    $("title").text(),
  ].filter(Boolean).join(" ").toLowerCase();

  // Check JSON-LD @type for category hints
  const ldTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item["@type"]) ldTypes.push(String(item["@type"]).toLowerCase());
        if (item.servesCuisine) {
          if (Array.isArray(item.servesCuisine)) ldTypes.push(...item.servesCuisine.map((c: string) => c.toLowerCase()));
          else ldTypes.push(String(item.servesCuisine).toLowerCase());
        }
      }
    } catch { /* skip */ }
  });

  const combined = text + " " + ldTypes.join(" ");

  // Map keywords to categories and subcategories
  const matches: { category: string; subcategory: string; weight: number }[] = [];

  const keywordMap: Record<string, Record<string, string[]>> = {
    dining: {
      "Fine dining": ["fine dining", "michelin", "prix fixe", "haute cuisine"],
      "Omakase": ["omakase", "sushi counter", "kaiseki"],
      "Seafood": ["seafood", "oyster", "raw bar", "ceviche", "lobster", "crab"],
      "Tasting menu": ["tasting menu", "degustation", "prix fixe", "multi-course"],
      "Brunch": ["brunch", "breakfast", "bottomless"],
      "Steakhouse": ["steakhouse", "steak house", "prime beef", "dry aged"],
      "Italian": ["italian", "trattoria", "osteria", "ristorante", "pasta", "risotto"],
      "French": ["french", "brasserie", "bistro", "provençal"],
      "Japanese": ["japanese", "izakaya", "ramen", "tempura", "robata", "yakitori"],
      "Mediterranean": ["mediterranean", "mezze", "levantine"],
      "Latin American": ["latin", "latino", "south american", "colombian", "brazilian", "argentinian"],
      "Mexican": ["mexican", "taqueria", "mezcal", "mole"],
      "Peruvian": ["peruvian", "nikkei", "ceviche", "pisco"],
      "Asian fusion": ["asian fusion", "pan-asian"],
      "Thai": ["thai", "pad thai"],
      "Indian": ["indian", "curry", "tandoor", "biryani"],
      "Middle Eastern": ["middle eastern", "lebanese", "turkish", "persian", "hummus", "shawarma"],
      "Greek": ["greek", "taverna", "souvlaki"],
      "Farm-to-table": ["farm-to-table", "farm to table", "locally sourced", "seasonal menu"],
      "Raw bar": ["raw bar", "crudo", "tartare"],
      "Sushi": ["sushi", "sashimi", "maki", "nigiri"],
      "Tapas": ["tapas", "small plates", "pintxos"],
      "Contemporary American": ["contemporary american", "modern american", "new american"],
      "New American": ["new american"],
      "Southern": ["southern", "cajun", "creole", "lowcountry"],
      "Barbecue": ["barbecue", "bbq", "barbeque", "smokehouse", "smoked"],
      "Pizza": ["pizza", "pizzeria", "neapolitan", "wood-fired"],
      "Vegan": ["vegan", "plant-based", "vegetarian"],
      "Chef's table": ["chef's table", "chefs table", "private dining"],
    },
    drinks: {
      "Cocktail bar": ["cocktail", "mixology", "craft cocktail"],
      "Wine bar": ["wine bar", "wine list", "sommelier"],
      "Speakeasy": ["speakeasy", "hidden bar", "secret bar", "password"],
      "Nightclub": ["nightclub", "club", "dj", "dance floor", "nightlife"],
      "Lounge": ["lounge"],
      "Rooftop bar": ["rooftop bar", "rooftop", "sky bar"],
      "Dive bar": ["dive bar", "neighborhood bar", "local bar"],
      "Tiki bar": ["tiki", "tropical cocktail"],
      "Mezcal bar": ["mezcal", "agave"],
      "Sake bar": ["sake bar", "sake"],
      "Champagne bar": ["champagne bar", "champagne lounge", "bubbles"],
      "Beer garden": ["beer garden", "biergarten"],
      "Brewery": ["brewery", "brewpub", "craft beer", "taproom"],
      "Sports bar": ["sports bar", "sports lounge"],
      "Jazz bar": ["jazz bar", "jazz club", "live jazz"],
      "Piano bar": ["piano bar", "piano lounge"],
      "Cigar lounge": ["cigar lounge", "cigar bar"],
      "Pool bar": ["pool bar", "poolside"],
      "Day club": ["day club", "dayclub", "day party", "pool party"],
      "Aperitivo": ["aperitivo", "aperitif", "spritz"],
      "Natural wine": ["natural wine", "low intervention", "skin contact"],
    },
    coffee: {
      "Specialty coffee": ["specialty coffee", "third wave", "pour over", "single origin", "v60"],
      "Roastery": ["roaster", "roastery", "coffee roast"],
      "Café": ["cafe", "café"],
      "Matcha": ["matcha", "ceremonial matcha"],
      "Tea house": ["tea house", "tea room", "loose leaf"],
      "Bakery café": ["bakery", "pastry", "viennoiserie", "croissant"],
      "Espresso bar": ["espresso bar", "espresso"],
      "Coffee lab": ["coffee lab", "coffee tasting"],
    },
    wellness: {
      "Gym": ["gym", "fitness center"],
      "Recovery": ["recovery", "recovery studio"],
      "Spa": ["spa", "day spa"],
      "Yoga": ["yoga", "hot yoga", "vinyasa", "ashtanga"],
      "Pilates": ["pilates", "reformer"],
      "Barbershop": ["barbershop", "barber"],
      "Salon": ["salon", "hair salon", "beauty salon"],
      "CrossFit": ["crossfit", "cross fit"],
      "Boxing": ["boxing", "boxing gym"],
      "Martial arts": ["martial arts", "mma", "jiu jitsu", "muay thai", "karate"],
      "Personal training": ["personal training", "personal trainer", "pt studio"],
      "Cold plunge": ["cold plunge", "ice bath", "cold water"],
      "Sauna": ["sauna", "steam room", "bathhouse"],
      "Cryotherapy": ["cryotherapy", "cryo"],
      "IV therapy": ["iv therapy", "iv drip", "vitamin drip"],
      "Medspa": ["medspa", "med spa", "medical spa", "botox", "filler"],
      "Float therapy": ["float", "sensory deprivation", "float tank"],
      "Massage": ["massage", "deep tissue", "sports massage"],
      "Facial studio": ["facial", "skincare studio"],
      "Nail studio": ["nail studio", "nail salon", "manicure", "pedicure"],
      "Acupuncture": ["acupuncture"],
      "Chiropractic": ["chiropractic", "chiropractor"],
      "Physical therapy": ["physical therapy", "physiotherapy"],
      "Cycling studio": ["cycling", "spin", "soulcycle"],
      "Dance studio": ["dance studio", "dance class"],
      "Climbing gym": ["climbing", "bouldering", "rock climbing"],
      "Tennis club": ["tennis", "tennis club", "padel"],
      "Golf": ["golf", "golf club", "driving range", "top golf"],
    },
    shopping: {
      "Fashion": ["fashion", "clothing", "apparel"],
      "Jewelry": ["jewelry", "jewellery", "jeweler", "fine jewelry"],
      "Watches": ["watches", "timepiece", "horology", "watch dealer"],
      "Art gallery": ["art gallery", "gallery", "exhibition", "contemporary art"],
      "Vintage": ["vintage", "consignment", "thrift", "resale", "pre-owned"],
      "Menswear": ["menswear", "men's clothing", "men's fashion"],
      "Womenswear": ["womenswear", "women's clothing", "women's fashion"],
      "Streetwear": ["streetwear", "hypebeast", "sneakerhead"],
      "Designer": ["designer", "luxury brand", "haute couture"],
      "Boutique": ["boutique", "curated shop"],
      "Sneakers": ["sneakers", "sneaker shop", "kicks"],
      "Eyewear": ["eyewear", "optical", "sunglasses"],
      "Leather goods": ["leather goods", "leather", "handbag"],
      "Home décor": ["home décor", "home decor", "interior design", "homeware"],
      "Furniture": ["furniture", "furnishing"],
      "Bookshop": ["bookshop", "bookstore", "books"],
      "Record shop": ["record shop", "record store", "vinyl"],
      "Plant shop": ["plant shop", "nursery", "plant store"],
      "Fragrance": ["fragrance", "perfume", "cologne", "scent"],
      "Concept store": ["concept store", "lifestyle store"],
      "Tailoring": ["tailoring", "tailor", "bespoke", "made to measure"],
      "Bridal": ["bridal", "wedding dress", "bridal boutique"],
      "Swimwear": ["swimwear", "swim", "bikini"],
      "Athleisure": ["athleisure", "activewear", "sportswear"],
    },
    members: {
      "Social club": ["social club", "members club", "private club", "membership"],
      "Business club": ["business club"],
      "Event space": ["event space", "private events", "event venue"],
      "Coworking": ["coworking", "co-working", "workspace", "shared office"],
      "Private dining": ["private dining", "private dining room"],
      "Wine club": ["wine club", "wine membership"],
      "Cigar club": ["cigar club"],
      "Beach club": ["beach club"],
      "Country club": ["country club"],
      "Networking club": ["networking", "networking club"],
      "Arts club": ["arts club", "art club", "creative club"],
      "Supper club": ["supper club"],
    },
    hotels: {
      "Boutique hotel": ["boutique hotel"],
      "Resort": ["resort", "beach resort"],
      "Villa": ["villa", "vacation rental"],
      "Design hotel": ["design hotel"],
      "Historic hotel": ["historic hotel", "heritage hotel"],
      "Beach hotel": ["beach hotel", "beachfront hotel", "oceanfront"],
      "Luxury hotel": ["luxury hotel", "five star", "5 star", "5-star"],
      "Aparthotel": ["aparthotel", "serviced apartment", "extended stay"],
      "Hostel": ["hostel"],
      "Bed & breakfast": ["bed and breakfast", "b&b", "bed & breakfast"],
      "Eco lodge": ["eco lodge", "eco hotel", "sustainable hotel"],
      "Wellness retreat": ["wellness retreat", "retreat", "detox retreat"],
      "Casino hotel": ["casino hotel", "casino resort"],
    },
  };

  // Also infer category from JSON-LD types
  const ldCategoryMap: Record<string, string> = {
    restaurant: "dining",
    foodestablishment: "dining",
    barorpub: "drinks",
    cafeorcoffeeshop: "coffee",
    hotel: "hotels",
    lodgingbusiness: "hotels",
    healthclub: "wellness",
    sportsactivitylocation: "wellness",
    store: "shopping",
  };

  let inferredCategory: string | undefined;
  for (const ldType of ldTypes) {
    if (ldCategoryMap[ldType]) {
      inferredCategory = ldCategoryMap[ldType];
      break;
    }
  }

  for (const [cat, subcats] of Object.entries(keywordMap)) {
    for (const [subcat, keywords] of Object.entries(subcats)) {
      for (const kw of keywords) {
        if (combined.includes(kw)) {
          matches.push({ category: cat, subcategory: subcat, weight: kw.length });
          break;
        }
      }
    }
  }

  // Default subcategory per category — used as fallback when no keywords match
  const defaultSubcategory: Record<string, string> = {
    dining: "Fine dining",
    drinks: "Cocktail bar",
    coffee: "Specialty coffee",
    wellness: "Gym",
    shopping: "Fashion",
    members: "Social club",
    hotels: "Boutique hotel",
  };

  // Pick the most common category, or use inferredCategory
  const categoryCounts = new Map<string, number>();
  for (const m of matches) {
    categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
  }
  const bestCategory = inferredCategory || (categoryCounts.size > 0 ? [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined);

  if (!bestCategory) {
    return { category: undefined, subcategory: [] };
  }

  // Return subcategories that match the best category
  const subcategories = [...new Set(matches.filter((m) => m.category === bestCategory).map((m) => m.subcategory))];

  // Fallback: ensure at least one subcategory
  if (subcategories.length === 0 && defaultSubcategory[bestCategory]) {
    subcategories.push(defaultSubcategory[bestCategory]);
  }

  return { category: bestCategory, subcategory: subcategories };
}

// Main scrape function
export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const { html, finalUrl } = await fetchPage(url);
  const $ = cheerio.load(html);

  const meta = extractMeta($);
  const jsonLd = extractJsonLd($);
  const instagram = extractInstagram($);
  const booking = extractBookingLinks($);
  const pageDetails = extractPageDetails($);

  // Merge — JSON-LD takes priority, then page extraction, then meta
  const merged: Partial<ScrapedData> = {
    name: jsonLd.name || meta.name,
    description: jsonLd.description || meta.description,
    address: jsonLd.address,
    phone: jsonLd.phone,
    website: finalUrl,
    hours: jsonLd.hours || pageDetails.hours,
    priceRange: jsonLd.priceRange || pageDetails.priceRange,
    dressCode: pageDetails.dressCode,
    parking: jsonLd.parking || pageDetails.parking,
    bookingUrl: booking.bookingUrl,
    bookingPlatform: booking.bookingPlatform,
    imageUrls: [...new Set([...(jsonLd.imageUrls || []), ...(meta.imageUrls || [])])].slice(0, 5),
    instagram: jsonLd.instagram || instagram || meta.instagram,
    lat: jsonLd.lat,
    lng: jsonLd.lng,
  };

  // Infer category and subcategories from page content
  const inferred = inferSubcategories(merged, $);

  // Infer neighborhood from address
  const neighborhood = inferNeighborhood(merged.address, merged.description);

  // Infer price range, dress code, parking from context if not scraped
  const finalPriceRange = merged.priceRange || inferPriceRange(inferred.category, inferred.subcategory);
  const finalDressCode = merged.dressCode || inferDressCode(inferred.category, inferred.subcategory);
  const finalParking = merged.parking || inferParking(merged.address);

  const result: ScrapedData = {
    ...merged,
    imageUrls: merged.imageUrls || [],
    category: inferred.category,
    subcategory: inferred.subcategory.length > 0 ? inferred.subcategory : undefined,
    neighborhood,
    priceRange: finalPriceRange,
    dressCode: finalDressCode,
    parking: finalParking,
  };

  return result;
}
