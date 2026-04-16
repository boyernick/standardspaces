import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = ["/", "/apply", "/login", "/auth/callback"];

// Link-preview / unfurler user agents. These have no user session, so
// without a bypass they'd be redirected to `/` on every protected path and
// shared space URLs would always unfurl with the landing watercolor instead
// of the per-space `generateMetadata` image. Covers iMessage (Applebot +
// facebookexternalhit), Messages on macOS, WhatsApp, Twitter/X, LinkedIn,
// Slack, Discord, Telegram, Skype, Reddit, Pinterest, and Embedly.
const LINK_PREVIEW_BOT_UA =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|applebot|skypeuripreview|redditbot|pinterest\/|embedly|mastodon/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.some((p) => pathname === p);
  const isLinkPreviewBot = LINK_PREVIEW_BOT_UA.test(
    request.headers.get("user-agent") || ""
  );

  // Short-circuit link-preview bots: they need to reach the page so the
  // per-route `generateMetadata` can emit the correct og:image. Skipping the
  // Supabase call here also saves an edge roundtrip per crawl.
  if (isLinkPreviewBot) {
    return NextResponse.next({ request });
  }

  // Refresh Supabase session on every request (including public paths)
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Logged-in user hitting landing page → redirect to their city
  if (user && pathname === "/") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("city")
      .eq("id", user.id)
      .single();
    const city = profile?.city || "Miami";
    const slug = city.toLowerCase().replace(/ /g, "-");
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}`;
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users on protected paths
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude Next internals, API routes, and anything with a file extension
    // (e.g. /og-cover.jpg, /favicon.png, /apple-touch-icon.png, fonts, svgs).
    // The previous allowlist missed several public/ assets, causing link
    // unfurlers (iMessage, Slack, etc.) to receive a 307 → / instead of the
    // OG image, silently dropping the preview thumbnail.
    "/((?!_next/static|_next/image|api/|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
