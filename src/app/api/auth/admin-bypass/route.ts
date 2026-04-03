import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";

const ADMIN_PHONE = "+15857048027";
const ADMIN_EMAIL = "nickboyer.bizz@gmail.com";

export async function POST(request: NextRequest) {
  const { phone } = await request.json();

  if (phone !== ADMIN_PHONE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Generate magic link token using admin email
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL,
  });

  if (linkError || !linkData) {
    console.error("generateLink error:", linkError);
    return NextResponse.json({ error: linkError?.message ?? "Failed to generate link" }, { status: 500 });
  }

  // Verify token server-side to get a session
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    console.error("verify error:", err);
    return NextResponse.json({ error: `Verify failed: ${err}` }, { status: 500 });
  }

  const session = await verifyRes.json();

  // Set session cookies
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(supabaseUrl, anonKey, {
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
  });

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (sessionError) {
    console.error("setSession error:", sessionError);
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Ensure profile exists with phone
  const userId = linkData.user.id;
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!existing) {
    await admin.from("profiles").insert({
      id: userId,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
    });
  } else {
    // Make sure phone is set on existing profile
    await admin.from("profiles").update({ phone: ADMIN_PHONE }).eq("id", userId);
  }

  return response;
}
