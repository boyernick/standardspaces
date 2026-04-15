import { NextRequest, NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { getSpotById } from "@/lib/data";
import { buildIcs, icsFilename } from "@/lib/ics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Intentionally unauthenticated — calendar clients (Google, Apple,
// Outlook) fetch .ics without our session cookie. Event IDs are UUIDs,
// so not trivially guessable; UUID validation rejects the cheapest
// scans. If private-event semantics land later, gate via a signed token
// in the URL rather than by session auth.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("Not found", { status: 404 });
  const event = await getEventById(id);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const spot = await getSpotById(event.spot_id);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://standardspaces.com";
  const ics = buildIcs(event, spot, baseUrl);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event)}"`,
    },
  });
}
