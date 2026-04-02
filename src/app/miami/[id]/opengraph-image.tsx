import { ImageResponse } from "next/og";
import { getSpotById } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = await getSpotById(id);

  if (!spot) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#F7F7F3", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#1a1a1a" }}>
        Not Found
      </div>,
      { ...size }
    );
  }

  const subtitle = [
    spot.category.map((c) => CATEGORY_LABELS[c]).join(" · "),
    spot.neighborhood,
  ].join(" · ");

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#F7F7F3",
      }}
    >
      {/* Left: spot photo */}
      <div style={{ display: "flex", width: "50%", height: "100%" }}>
        {spot.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.images[0]}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", background: "#e5e5e0" }} />
        )}
      </div>

      {/* Right: branded card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "50%",
          height: "100%",
          padding: "48px",
        }}
      >
        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 600,
              color: "#1a1a1a",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            {spot.name}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#737373",
              marginBottom: 24,
            }}
          >
            {subtitle}
            {spot.priceRange ? ` · ${spot.priceRange}` : ""}
          </div>

          {/* Vibes */}
          {spot.vibes && spot.vibes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {spot.vibes.slice(0, 3).map((vibe) => (
                <div
                  key={vibe}
                  style={{
                    fontSize: 14,
                    color: "#737373",
                    background: "#ededed",
                    borderRadius: 999,
                    padding: "6px 14px",
                  }}
                >
                  {vibe}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F7F7F3",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 16, color: "#737373" }}>
            Standard Spaces
          </div>
        </div>
      </div>
    </div>,
    { ...size }
  );
}
