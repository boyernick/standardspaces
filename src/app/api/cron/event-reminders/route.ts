import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Event reminder cron. Vercel hits this once a day (14:00 UTC) — the Hobby
 * plan caps crons at one run per day, so the previous 15-minute cadence is
 * no longer available. To preserve "heads up" reminders we scan events
 * starting within the next ~26 hours on every run and insert the 24h
 * reminder. The 1h reminder window is dropped until we're on Pro.
 *
 * The dedupe key `event_reminder_24h:<eventId>` guarantees each user
 * receives at most one reminder per event even if the cron runs overlap or
 * retry on the same day.
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
    // Daily run → scan a 26h window starting from "now" to catch every event
    // that will start before the next run (24h later) plus a small overlap.
    const windows = [
      {
        type: "event_reminder_24h" as const,
        from: new Date(now).toISOString(),
        to: new Date(now + 26 * 3600 * 1000).toISOString(),
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
