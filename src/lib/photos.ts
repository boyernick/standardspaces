import { createAdminClient } from "./supabase/admin";

/**
 * Where inside the `spot-photos` storage bucket this upload lives.
 * Recommendations and spots get separate prefixes so a re-scrape of a
 * published listing doesn't clobber the staging rec's folder.
 */
type StorageScope =
  | { kind: "recommendation"; id: string }
  | { kind: "spot"; id: string };

function pathFor(scope: StorageScope, index: number, ext: string): string {
  const prefix =
    scope.kind === "recommendation" ? "recommendations" : "spots";
  return `${prefix}/${scope.id}/${index}.${ext}`;
}

export async function downloadAndUploadPhoto(
  imageUrl: string,
  scopeOrRecId: StorageScope | string,
  index: number
): Promise<string | null> {
  // Back-compat: older callers pass a bare `recommendationId` string.
  const scope: StorageScope =
    typeof scopeOrRecId === "string"
      ? { kind: "recommendation", id: scopeOrRecId }
      : scopeOrRecId;
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

    // Skip small images — the 10KB floor was too permissive and kept
    // letting through low-res thumbnails. 30KB cleanly separates real
    // photos from icons and tracking pixels in practice.
    if (buffer.byteLength < 30000) return null;

    const path = pathFor(scope, index, ext);

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
  scopeOrRecId: StorageScope | string
): Promise<string[]> {
  const scope: StorageScope =
    typeof scopeOrRecId === "string"
      ? { kind: "recommendation", id: scopeOrRecId }
      : scopeOrRecId;
  const results = await Promise.allSettled(
    imageUrls.slice(0, 10).map((url, i) =>
      downloadAndUploadPhoto(url, scope, i)
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((url): url is string => url !== null);
}
