"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, Heart, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS } from "@/lib/types";
import type { Category } from "@/lib/types";

type InteractionType = "bookmark" | "favorite" | "checkin";

interface SpotCard {
  id: string;
  name: string;
  category: Category[];
  neighborhood: string;
  city: string;
  images: string[];
}

const tabs: { type: InteractionType; label: string; Icon: typeof Bookmark; emptyMsg: string }[] = [
  { type: "bookmark", label: "Bookmarks", Icon: Bookmark, emptyMsg: "No saved spots yet. Bookmark spots you want to visit." },
  { type: "favorite", label: "Favorites", Icon: Heart, emptyMsg: "No favorites yet. Heart the spots you love." },
  { type: "checkin", label: "Been Here", Icon: CheckCircle, emptyMsg: "No check-ins yet. Mark spots you've visited." },
];

export default function ProfileTabs({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<InteractionType>("bookmark");
  const [spots, setSpots] = useState<Record<InteractionType, SpotCard[]>>({
    bookmark: [],
    favorite: [],
    checkin: [],
  });
  const [loaded, setLoaded] = useState<Set<InteractionType>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    if (loaded.has(activeTab)) return;

    async function fetchSpots() {
      const { data: interactions } = await supabase
        .from("user_interactions")
        .select("spot_id")
        .eq("user_id", userId)
        .eq("type", activeTab);

      if (!interactions || interactions.length === 0) {
        setLoaded((prev) => new Set(prev).add(activeTab));
        return;
      }

      const spotIds = interactions.map((i) => i.spot_id);
      const { data: spotData } = await supabase
        .from("spots")
        .select("id, name, category, neighborhood, city, images")
        .in("id", spotIds);

      if (spotData) {
        setSpots((prev) => ({
          ...prev,
          [activeTab]: spotData as SpotCard[],
        }));
      }
      setLoaded((prev) => new Set(prev).add(activeTab));
    }
    fetchSpots();
  }, [activeTab, userId, loaded]);

  const currentTab = tabs.find((t) => t.type === activeTab)!;
  const currentSpots = spots[activeTab];
  const isLoaded = loaded.has(activeTab);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map(({ type, label, Icon }) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === type
                ? "border-brand-900 text-brand-900"
                : "border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {!isLoaded ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-brand-900 rounded-full animate-spin" />
          </div>
        ) : currentSpots.length === 0 ? (
          <div className="text-center py-16">
            <currentTab.Icon size={32} strokeWidth={1.5} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              {currentTab.emptyMsg}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentSpots.map((spot) => (
              <Link
                key={spot.id}
                href={`/miami/${spot.id}`}
                className="group overflow-hidden border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
              >
                {spot.images.length > 0 && (
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={spot.images[0]}
                      alt={spot.name}
                      loading="lazy"
                      className="w-full h-full object-cover spot-img group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-3.5">
                  <h3
                    className="text-sm font-medium group-hover:text-neutral-900 dark:group-hover:text-white"
                    style={{ fontFamily: "var(--font-calibre), system-ui, sans-serif" }}
                  >
                    {spot.name}
                  </h3>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {spot.neighborhood}, {spot.city}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
