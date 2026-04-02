import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserSaves } from "@/app/actions/saves";
import { getSpotById } from "@/lib/data";
import { CATEGORY_LABELS, Spot } from "@/lib/types";
import Navbar from "@/components/Navbar";
import ImageCarousel from "@/components/ImageCarousel";
import SaveButton from "@/components/SaveButton";
import { Heart } from "lucide-react";

export default async function SavedPage() {
  await requireAuth();
  const savedIds = await getUserSaves();

  const spots = (
    await Promise.all(savedIds.map((id) => getSpotById(id)))
  ).filter((s): s is Spot => s !== null);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          <h1 className="text-xl font-semibold tracking-tight mb-6">Saved spaces</h1>

          {spots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <Heart size={20} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-medium">No saved spaces yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                Tap the heart on any space to save it here for later.
              </p>
              <Link href="/miami" className="inline-block mt-4 text-sm font-medium text-neutral-900 dark:text-white hover:underline">
                Browse spaces
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
              {spots.map((spot) => (
                <div key={spot.id}>
                  <div className="relative">
                    <Link href={`/miami/${spot.id}`}>
                      <ImageCarousel images={spot.images} alt={spot.name} />
                    </Link>
                    <SaveButton spotId={spot.id} initialSaved={true} size="sm" />
                  </div>
                  <div className="mt-3">
                    <h3 className="font-medium text-base leading-tight">{spot.name}</h3>
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")} · {spot.neighborhood}
                      {spot.priceRange && <span> · {spot.priceRange}</span>}
                    </p>
                    {spot.vibes && spot.vibes.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {spot.vibes.slice(0, 3).map((vibe) => (
                          <span key={vibe} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">{vibe}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
