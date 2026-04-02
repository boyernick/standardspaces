"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, Category } from "@/lib/types";
import { Search } from "lucide-react";

type SpotRow = {
  id: string;
  name: string;
  category: string[];
  neighborhood: string;
  city: string;
  images: string[];
};

export default function ListingsTable({ spots }: { spots: SpotRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? spots.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.neighborhood.toLowerCase().includes(query.toLowerCase()) ||
          s.category.some((c: string) => c.toLowerCase().includes(query.toLowerCase()))
      )
    : spots;

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };

  return (
    <div>
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search listings..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-black/10 rounded-lg bg-white focus:outline-none focus:border-black/30 transition-colors"
          style={fontCalibre}
        />
      </div>

      <p className="text-xs text-black/40 mb-3" style={fontCalibre}>
        {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/40 py-8 text-center" style={fontCalibre}>No listings found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((spot) => (
            <Link
              key={spot.id}
              href={`/admin/listings/${spot.id}`}
              className="flex items-center gap-4 p-3 border border-black/10 rounded-lg bg-white hover:border-black/20 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                {spot.images?.[0] ? (
                  <img src={spot.images[0]} alt={spot.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
                    No img
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={fontCalibre}>{spot.name}</p>
                <p className="text-xs text-black/50" style={fontCalibre}>
                  {spot.category.map((c) => CATEGORY_LABELS[c as Category] || c).join(" · ")} · {spot.neighborhood}
                </p>
              </div>
              <span className="text-xs text-black/30 shrink-0" style={fontCalibre}>Edit</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
