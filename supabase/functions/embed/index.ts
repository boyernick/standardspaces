// Edge Function: produces 384-dim embeddings via the built-in gte-small
// model. Deployed once with `supabase functions deploy embed`.
//
// Called server-side only — from the admin publish/edit routes, the
// /api/search/semantic endpoint, and the backfill script. Clients should
// never hit this directly; Supabase enforces that callers present a valid
// anon or service-role JWT in the Authorization header.
//
// Request:  POST { text: string }
// Response: 200 { embedding: number[] } | 400 { error: string }

// @ts-expect-error Supabase Edge runtime injects Deno + Supabase globals.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  // Custom auth: we deploy with verify_jwt=false because Supabase's new
  // sb_secret_* keys aren't JWTs and fail the built-in check. Instead we
  // require the service role secret in the Authorization header — all our
  // callers are server-side and already have it.
  // @ts-expect-error Deno global
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") || "";
  const presented = authHeader.replace(/^Bearer\s+/i, "");
  if (!expected || presented !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let text: unknown;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (typeof text !== "string" || !text.trim()) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (text.length > 8000) {
    // gte-small tokenizer caps at ~512 tokens; truncate defensively so a
    // pathological input doesn't blow up the runtime.
    text = text.slice(0, 8000);
  }

  // @ts-expect-error Supabase global provided by Edge runtime
  const session = new Supabase.ai.Session("gte-small");
  const embedding = await session.run(text, {
    mean_pool: true,
    normalize: true,
  });

  return new Response(JSON.stringify({ embedding }), {
    headers: { "content-type": "application/json" },
  });
});
