import { NextRequest, NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { getSpotById } from "@/lib/data";
import { buildIcs, icsFilename } from "@/lib/ics";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
