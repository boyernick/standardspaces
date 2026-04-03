import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { citySlugFromName } from "@/lib/cities";

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
  }

  // Rebuild response with correct city redirect, preserving cookies
  const citySlug = citySlugFromName(userCity);
  const finalResponse = NextResponse.redirect(new URL(`/${citySlug}`, origin));
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });

  return finalResponse;
}
