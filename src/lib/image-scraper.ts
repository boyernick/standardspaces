// Image-only HTML scrape. Perplexity sources every text field now, but its
// citations point to pages not image files, so we still need a Cheerio pass
// over the venue's own HTML to collect image URLs for processPhotos().
//
// This is the narrowed replacement for the old src/lib/scraper.ts. It keeps
// the resilient fetch (403/bot-wall tolerant), the og:image / srcset /
// background-image extractors, and the reject/boost scoring that filters
// out logos, icons, tracking pixels, and favors hero/gallery photos.

import * as cheerio from "cheerio";

export class FetchPageError extends Error {
  httpStatus: number;
  constructor(status: number, url: string) {
    super(`Fetch failed: HTTP ${status} for ${url}`);
    this.name = "FetchPageError";
    this.httpStatus = status;
  }
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new FetchPageError(res.status, res.url || url);
  }
  const html = await res.text();
  return { html, finalUrl: res.url };
}

// Titles / body snippets that indicate a JS challenge page instead of real
// content. We short-circuit on these so we don't parse Cloudflare's "Just a
// moment…" page as if it were a restaurant homepage.
const BOT_WALL_SIGNALS = [
  "just a moment",
  "checking your browser",
  "please wait",
  "access denied",
  "attention required",
  "cf-browser-verification",
  "ray id",
];

function isBotWall($: cheerio.CheerioAPI): boolean {
  const title = $("title").text().trim().toLowerCase();
  const bodyText = $("body").text().slice(0, 2000).toLowerCase();
  const elementCount = $("body *").length;
  if (elementCount < 15 && BOT_WALL_SIGNALS.some((s) => title.includes(s) || bodyText.includes(s))) {
    return true;
  }
  if (bodyText.includes("cf-browser-verification") || bodyText.includes("challenge-platform")) {
    return true;
  }
  return false;
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// Hard reject — these patterns almost always catch non-content images:
// logos, icons, tracking pixels, staff portraits, social/payment badges.
const IMAGE_REJECT_PATTERNS = [
  /logo/i, /icon/i, /favicon/i, /sprite/i, /spacer/i, /pixel/i, /tracking/i,
  /badge/i, /avatar/i, /profile[-_]?pic/i, /gravatar/i, /widget/i, /button/i,
  /team[-_]?photo/i, /headshot/i, /portrait/i, /staff[-_]?photo/i, /employee/i,
  /family/i, /selfie/i, /person/i, /people/i, /founder/i, /about[-_]?us/i,
  /\.svg(\?|$)/i, /\.gif(\?|$)/i, /1x1/i, /transparent/i, /blank\./i,
  /facebook\.com/i, /twitter\.com/i, /google-analytics/i, /doubleclick/i,
  /adsystem/i, /adserver/i, /cloudflare/i, /recaptcha/i,
  /payment/i, /credit[-_]?card/i, /visa\b/i, /mastercard/i, /amex/i,
  /arrow/i, /chevron/i, /caret/i, /close[-_]?btn/i, /hamburger/i,
  /share[-_]?icon/i, /social[-_]?icon/i, /map[-_]?pin/i, /marker/i,
];

const IMAGE_BOOST_PATTERNS: { pattern: RegExp; boost: number }[] = [
  { pattern: /hero/i, boost: 15 },
  { pattern: /gallery/i, boost: 12 },
  { pattern: /banner/i, boost: 8 },
  { pattern: /photo/i, boost: 8 },
  { pattern: /image/i, boost: 5 },
  { pattern: /interior/i, boost: 12 },
  { pattern: /exterior/i, boost: 10 },
  { pattern: /food/i, boost: 10 },
  { pattern: /dish/i, boost: 10 },
  { pattern: /cocktail/i, boost: 10 },
  { pattern: /dining/i, boost: 10 },
  { pattern: /restaurant/i, boost: 8 },
  { pattern: /bar\b/i, boost: 8 },
  { pattern: /lounge/i, boost: 8 },
  { pattern: /pool/i, boost: 8 },
  { pattern: /rooftop/i, boost: 8 },
  { pattern: /spa\b/i, boost: 8 },
  { pattern: /gym/i, boost: 8 },
  { pattern: /room/i, boost: 6 },
  { pattern: /ambiance|ambience|atmosphere/i, boost: 10 },
  { pattern: /featured/i, boost: 8 },
  { pattern: /slide/i, boost: 6 },
  { pattern: /carousel/i, boost: 6 },
  { pattern: /cover/i, boost: 6 },
  { pattern: /main/i, boost: 5 },
];

function collectCandidates($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = [];
  const add = (u: string | undefined) => {
    if (!u) return;
    const resolved = resolveUrl(u, baseUrl);
    if (!urls.includes(resolved)) urls.push(resolved);
  };

  // OG images first — these are the site's own chosen hero.
  $('meta[property="og:image"]').each((_, el) => add($(el).attr("content")));
  // Twitter card image — almost always the same as OG but worth checking.
  add($('meta[name="twitter:image"]').attr("content"));

  // All <img> elements, including common lazy-load attrs.
  $("img").each((_, el) => {
    add($(el).attr("src"));
    add($(el).attr("data-src"));
    add($(el).attr("data-lazy-src"));
  });

  // srcset — pick the largest variant.
  $("img[srcset], source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    const candidates = srcset.split(",").map((s) => s.trim().split(/\s+/));
    let bestUrl = "";
    let bestWidth = 0;
    for (const [url, descriptor] of candidates) {
      const w = parseInt(descriptor) || 0;
      if (w > bestWidth && url) {
        bestWidth = w;
        bestUrl = url;
      }
    }
    add(bestUrl);
  });

  // Inline CSS background-image — many sites stash hero images here.
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const m = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (m && m[1]) add(m[1]);
  });

  return urls;
}

function scoreAndRank(candidates: string[], $: cheerio.CheerioAPI): string[] {
  const scored: { url: string; score: number }[] = [];

  for (const url of candidates) {
    if (IMAGE_REJECT_PATTERNS.some((p) => p.test(url))) continue;

    let score = 0;
    const isOgImage =
      $(`meta[property="og:image"][content="${url}"]`).length > 0;
    if (isOgImage) score += 20;

    for (const { pattern, boost } of IMAGE_BOOST_PATTERNS) {
      if (pattern.test(url)) {
        score += boost;
        break;
      }
    }

    const imgEl = $(`img[src="${url}"], img[data-src="${url}"], img[data-lazy-src="${url}"]`);
    if (imgEl.length > 0) {
      const width = parseInt(imgEl.attr("width") || "0");
      const height = parseInt(imgEl.attr("height") || "0");
      if (width > 0 && height > 0) {
        const area = width * height;
        if (area >= 500000) score += 20;
        else if (area >= 200000) score += 15;
        else if (area >= 80000) score += 8;
        else if (area < 10000) score -= 20;
        else if (area < 40000) score -= 5;

        const ratio = width / height;
        if (ratio >= 1.2 && ratio <= 2.0) score += 8;
        else if (ratio >= 0.6 && ratio < 1.2) score += 4;
        else if (ratio > 3 || ratio < 0.3) score -= 10;
      }

      const alt = (imgEl.attr("alt") || "").toLowerCase();
      if (alt.length > 5 && alt.length < 100) score += 3;
      for (const { pattern, boost } of IMAGE_BOOST_PATTERNS) {
        if (pattern.test(alt)) {
          score += Math.floor(boost * 0.5);
          break;
        }
      }

      const parentClass =
        (imgEl.parent().attr("class") || "") +
        " " +
        (imgEl.closest("section, div").attr("class") || "");
      if (/hero|banner|gallery|carousel|slider|featured|spotlight/i.test(parentClass)) {
        score += 10;
      }
      if (/nav|footer|sidebar|widget|cookie|popup|modal/i.test(parentClass)) {
        score -= 15;
      }
    } else {
      score += 5;
    }

    if (/\d{3,4}x\d{3,4}/.test(url)) score += 5;
    if (/thumb|thumbnail|small|tiny|micro/i.test(url)) score -= 10;
    if (/large|full|original|high|hd|retina|2x/i.test(url)) score += 5;
    if (/ctfassets\.net|cloudinary|imgix|unsplash|squarespace-cdn/i.test(url)) score += 5;

    scored.push({ url, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map((s) => s.url);
}

export interface ExtractImagesOptions {
  /** Pre-fetched HTML, if the caller already has it. Saves a fetch. */
  html?: string;
}

/**
 * Fetch the page (if needed) and return a scored, deduped list of up to
 * 10 likely venue-photo URLs. Fully absolute URLs, ready for processPhotos.
 *
 * Never throws — returns [] on network/bot-wall failure. Image extraction
 * is best-effort; the admin can always add photos by hand.
 */
export async function extractImagesFromUrl(
  url: string,
  options: ExtractImagesOptions = {},
): Promise<string[]> {
  let html: string;
  let finalUrl: string;
  if (options.html) {
    html = options.html;
    finalUrl = url;
  } else {
    try {
      ({ html, finalUrl } = await fetchPage(url));
    } catch (err) {
      if (err instanceof Error && err.name === "FetchPageError") {
        console.warn(`extractImagesFromUrl: ${err.message}`);
      } else {
        console.warn("extractImagesFromUrl: fetch failed", err);
      }
      return [];
    }
  }

  const $ = cheerio.load(html);
  if (isBotWall($)) {
    console.warn(`extractImagesFromUrl: bot wall for ${url}`);
    return [];
  }

  const candidates = collectCandidates($, finalUrl);
  return scoreAndRank(candidates, $);
}
