// Category-aware shot lists + weighting for the photo curation selector.
// Every admin form category maps to an ordered list of required roles; the
// selector uses this to turn a "rank the best photos" problem into a
// "pick the set that covers the venue" problem.
//
// Role identifiers stay snake_case internally (stable enum values for the
// Anthropic tool schema); `humanizeRole` converts them to title case for
// the modal UI per AGENTS.md typography rules.

import type { Category } from "./types";

/** Composite score cutoff below which a Pass-1 role slot stays empty. */
export const MIN_ROLE_THRESHOLD = 60;

/** Target size of the curated set, soft cap (Pass 2 fills to this). */
export const TARGET_PHOTO_COUNT = 8;

/** Per-role maximum in the final selection — prevents 4x cocktail shots. */
export const PER_ROLE_CAP = 2;

/** Weighting applied client-side to subscores to produce the composite. */
export const SCORE_WEIGHTS = {
  visual_quality: 0.3,
  ambiance: 0.2,
  offerings: 0.15,
  brand_fit: 0.15,
  informational: 0.1,
  authenticity: 0.1,
} as const;

export type SubscoreKey = keyof typeof SCORE_WEIGHTS;

/**
 * Role lists are ordered by importance — first role is the hero slot.
 * Pass 1 of the selector walks this order, so if coverage has to be
 * trimmed (pool is too thin), the hero fills first.
 */
export const SHOT_LISTS: Record<Category, readonly string[]> = {
  dining: [
    "hero_interior",
    "signature_dish",
    "dining_room",
    "plating_closeup",
    "drink",
    "crowd",
    "exterior",
    "design_detail",
    "staff_service",
  ],
  drinks: [
    "hero_interior",
    "cocktail",
    "bar_back",
    "crowd_energy",
    "lighting_mood",
    "seating",
    "exterior",
    "design_detail",
  ],
  coffee: [
    "espresso_drink",
    "counter",
    "pastry_or_food",
    "seating_work",
    "exterior_signage",
    "design_detail",
    "crowd",
  ],
  wellness: [
    "studio_floor",
    "class_action",
    "equipment",
    "amenity",
    "branding",
    "trainer_or_staff",
    "design_detail",
  ],
  members: [
    "lounge_hero",
    "common_area",
    "event_people",
    "amenity",
    "design_detail",
    "branding",
    "food_or_drink",
  ],
  shopping: [
    "exterior",
    "storefront",
    "merchandise",
    "shopping_scene",
    "design_detail",
    "branding",
  ],
  hotels: [
    "lobby_hero",
    "guest_room",
    "pool_amenity",
    "fb_outlet",
    "exterior",
    "design_detail",
    "spa_wellness",
  ],
};

/** Fallback for photos that don't fit any category-specific role. */
export const GENERIC_ROLE = "generic";

/**
 * Union of required roles across one or more categories, preserving the
 * first-seen ordering (importance). A spot tagged both `dining` and
 * `drinks` gets `hero_interior, signature_dish, dining_room, ...,
 * cocktail, bar_back, ...` — dining's hero beats drinks's because it
 * appeared first in the category array.
 */
export function rolesForCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of categories) {
    const roles = SHOT_LISTS[raw as Category];
    if (!roles) continue;
    for (const role of roles) {
      if (!seen.has(role)) {
        seen.add(role);
        out.push(role);
      }
    }
  }
  return out;
}

/**
 * Convert `signature_dish` → "Signature dish" for badge display.
 * Never all-caps (AGENTS.md typography rule), never hyphens.
 */
export function humanizeRole(role: string): string {
  const spaced = role.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Composite score from subscores. Pure weighted sum — no nonlinearities.
 * Claude emits subscores 0–100; composite lands in the same range.
 */
export function computeComposite(subscores: Record<SubscoreKey, number>): number {
  let sum = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS) as [SubscoreKey, number][]) {
    const v = subscores[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v * weight;
    }
  }
  return Math.round(sum * 10) / 10; // 1 decimal place
}
