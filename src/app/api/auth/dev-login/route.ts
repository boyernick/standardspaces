import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Generate a magic link to get a valid token
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (linkError || !linkData) {
    return NextResponse.json(
      { error: linkError?.message ?? "Failed to generate link" },
      { status: 500 }
    );
  }

  // Verify the token server-side via Supabase REST to get a session
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    return NextResponse.json(
      { error: `Verify failed: ${err}` },
      { status: 500 }
    );
  }

  const session = await verifyRes.json();

  // Now use setSession on a proper Supabase SSR client to set cookies correctly
  const response = NextResponse.redirect(
    new URL("/miami", request.nextUrl.origin) // Default, will be updated below
  );

  const supabase = createServerClient(
    supabaseUrl,
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

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (sessionError) {
    return NextResponse.json(
      { error: sessionError.message },
      { status: 500 }
    );
  }

  // Ensure profile exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", linkData.user.id)
    .single();

  if (!existing) {
    await admin.from("profiles").insert({
      id: linkData.user.id,
      email,
    });
  }

  return response;
}
