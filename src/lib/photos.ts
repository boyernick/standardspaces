import { createAdminClient } from "./supabase/admin";

export async function downloadAndUploadPhoto(
  imageUrl: string,
  recommendationId: string,
  index: number
): Promise<string | null> {
  try {
    // Download the image
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*",
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = await res.arrayBuffer();

    // Skip tiny images (likely icons)
    if (buffer.byteLength < 10000) return null;

    const path = `recommendations/${recommendationId}/${index}.${ext}`;

    const { error } = await createAdminClient().storage
      .from("spot-photos")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    // Get public URL
    const { data } = createAdminClient().storage
      .from("spot-photos")
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.error("Photo download/upload failed:", err);
    return null;
  }
}

export async function processPhotos(
  imageUrls: string[],
  recommendationId: string
): Promise<string[]> {
  const results = await Promise.allSettled(
    imageUrls.slice(0, 5).map((url, i) =>
      downloadAndUploadPhoto(url, recommendationId, i)
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((url): url is string => url !== null);
}
