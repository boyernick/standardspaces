"use client";

import { useState } from "react";
import Link from "next/link";
import { getSpotsByCity } from "@/lib/data";
import { CATEGORY_LABELS, Category } from "@/lib/types";

const allSpots = getSpotsByCity("Miami");
const categories = [...new Set(allSpots.map((s) => s.category))] as Category[];

export default function MiamiPage() {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const filtered = activeCategory
    ? allSpots.filter((s) => s.category === activeCategory)
    : allSpots;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* City Header */}
      <div className="mb-12">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 mb-2">
          City Guide
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Miami</h1>
        <p className="mt-3 text-neutral-500">
          {allSpots.length} curated spaces
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 mb-10 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 text-sm rounded-full border transition-colors ${
            activeCategory === null
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm rounded-full border transition-colors ${
              activeCategory === cat
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Spots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200">
        {filtered.map((spot) => (
          <Link
            key={spot.id}
            href={`/miami/${spot.id}`}
            className="group bg-white p-6 hover:bg-neutral-50 transition-colors"
          >
            {/* Placeholder image area */}
            <div className="aspect-[4/3] bg-neutral-100 mb-5" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-base">{spot.name}</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  {CATEGORY_LABELS[spot.category]} · {spot.neighborhood}
                </p>
              </div>
              <span className="text-neutral-300 group-hover:text-neutral-900 transition-colors mt-1">
                →
              </span>
            </div>

            <p className="text-sm text-neutral-500 mt-3 leading-relaxed line-clamp-2">
              {spot.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
