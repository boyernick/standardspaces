import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { citySlugFromName } from "@/lib/cities";
import { trackServer } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/", origin));
  }

  // Create a mutable response we'll redirect at the end
  let response = NextResponse.redirect(new URL("/miami", origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/", origin));
  }

  // Create profile if it doesn't exist, get city preference
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id, city")
    .eq("id", data.user.id)
    .single();

  let userCity = "Miami";

  if (existing) {
    userCity = existing.city || "Miami";
    // Returning user — signin event. The callback fires for every OTP /
    // magic-link exchange, so this represents one authenticated session
    // hand-off per login.
    await trackServer("signin", {}, data.user.id);
  } else {
    // Look up city from application by phone
    const phone = data.user.phone;
    if (phone) {
      const { data: appData } = await admin
        .from("applications")
        .select("city")
        .eq("phone", phone)
        .single();
      userCity = appData?.city || "Miami";
    }

    await admin.from("profiles").insert({
      id: data.user.id,
      email: data.user.email,
      city: userCity,
    });

    // Seed a follow of the house account (MySpace-Tom style) so every
    // new member lands with at least one connection in their feed.
    // Opt-in: only runs when `DEFAULT_FOLLOW_USER_ID` is set. Guarded
    // against self-follow so the default account itself can sign up
    // without tripping the insert. Best-effort — we don't fail signup
    // if the follow insert hits a race or constraint.
    const defaultFollow = process.env.DEFAULT_FOLLOW_USER_ID;
    if (defaultFollow && defaultFollow !== data.user.id) {
      await admin
        .from("user_follows")
        .insert({
          follower_id: data.user.id,
          following_id: defaultFollow,
        });
    }

    // First-time profile row insert == signup completion. `city` is the
    // value we just resolved from their application row (or the default),
    // i.e. the city they'll land on after the redirect.
    await trackServer("signup_complete", { city: userCity }, data.user.id);
  }

  // Rebuild response with correct city redirect, preserving cookies
  const citySlug = citySlugFromName(userCity);
  const finalResponse = NextResponse.redirect(new URL(`/${citySlug}`, origin));
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });

  return finalResponse;
}
