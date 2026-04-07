import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Event reminder cron. Vercel hits this every 15 minutes.
 * - For events starting in ~24h (±15m window): insert `event_reminder_24h`.
 * - For events starting in ~1h (±15m window): insert `event_reminder_1h`.
 * The dedupe key `event_reminder_{24h,1h}:<eventId>` guarantees each user
 * receives at most one reminder per event per window even with overlapping
 * runs or retries.
 */
export async function GET(req: NextRequest) {
  try {
    // Auth: Vercel cron automatically sets this header; accept a manual
    // test-run header too for local dev.
    const auth = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = Date.now();
    const windows = [
      {
        type: "event_reminder_24h" as const,
        from: new Date(now + 23 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
        to: new Date(now + 24 * 3600 * 1000 + 15 * 60 * 1000).toISOString(),
      },
      {
        type: "event_reminder_1h" as const,
        from: new Date(now + 45 * 60 * 1000).toISOString(),
        to: new Date(now + 75 * 60 * 1000).toISOString(),
      },
    ];

    let inserted = 0;

    for (const w of windows) {
      const { data: events } = await admin
        .from("events")
        .select("id")
        .eq("status", "published")
        .gte("starts_at", w.from)
        .lte("starts_at", w.to);
      if (!events || events.length === 0) continue;

      for (const e of events) {
        const { data: rsvps } = await admin
          .from("event_rsvps")
          .select("user_id")
          .eq("event_id", e.id)
          .eq("status", "going");
        if (!rsvps || rsvps.length === 0) continue;

        // Respect per-user prefs (events category).
        const userIds = rsvps.map((r) => r.user_id as string);
        const { data: profs } = await admin
          .from("profiles")
          .select("id, notification_prefs")
          .in("id", userIds);

        const rows = (profs ?? [])
          .filter((p) => {
            const prefs = (p.notification_prefs ?? {}) as Record<string, boolean>;
            return prefs.events !== false;
          })
          .map((p) => ({
            user_id: p.id as string,
            type: w.type,
            event_id: e.id,
            dedupe_key: `${w.type}:${e.id}`,
            metadata: {},
          }));

        if (rows.length === 0) continue;
        const { error, count } = await admin
          .from("notifications")
          .insert(rows, { count: "exact" });
        if (error && error.code !== "23505") {
          console.error("event-reminders insert error:", error.message);
        } else if (count) {
          inserted += count;
        }
      }
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (err) {
    console.error("event-reminders cron error:", err);
    return NextResponse.json({ error: "cron failed" }, { status: 500 });
  }
}
