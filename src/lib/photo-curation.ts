// Photo curation = score candidates → select a balanced coverage set.
//
// `scoreCandidates` makes one batched multimodal call to Claude with every
// candidate image, using forced tool-use so the response is strict JSON.
// `selectBalanced` is a pure function — easy to unit test without touching
// the network — that turns scored candidates into the final admin picks.

import { multimodalToolCall, estimateSonnetCost } from "./anthropic";
import {
  GENERIC_ROLE,
  MIN_ROLE_THRESHOLD,
  PER_ROLE_CAP,
  SCORE_WEIGHTS,
  SHOT_LISTS,
  TARGET_PHOTO_COUNT,
  computeComposite,
  rolesForCategories,
} from "./shot-lists";
import type { SubscoreKey } from "./shot-lists";

export interface CandidateInput {
  url: string;
  /** Where the URL came from — threads into provenance. */
  source: "places" | "scraped_places" | "scraped_html" | "scraped_perplexity" | "unknown";
}

export interface ScoredCandidate {
  url: string;
  source: CandidateInput["source"];
  role: string;
  subscores: Record<SubscoreKey, number>;
  composite: number;
  reasoning: string;
}

export interface ScoreResult {
  scored: ScoredCandidate[];
  tokenCost: number;
  usage: { inputTokens: number; outputTokens: number };
}

/** Hard cap on pool size — prevents runaway prompts + cost spikes. */
export const MAX_CANDIDATES = 25;

/** Minimum pool size below which scoring is pointless. */
export const MIN_CANDIDATES = 3;

/**
 * Authenticity floor. Event flyers, promo graphics, artist portraits, and
 * amateur snapshots are instructed to score ≤ 15; anything under this floor
 * is excluded from selection outright so it never lands on a published card.
 */
export const MIN_AUTHENTICITY = 25;

/**
 * Batched Claude Sonnet 4.6 call scoring every candidate image at once.
 * Returns the aligned `ScoredCandidate[]` in the same order as the input.
 * Throws `AnthropicError` on any failure; caller surfaces the stage.
 */
export async function scoreCandidates(
  candidates: CandidateInput[],
  categories: string[],
): Promise<ScoreResult> {
  if (candidates.length === 0) {
    return { scored: [], tokenCost: 0, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  // Truncate to the hard cap — caller should warn upstream if the pool was
  // much larger, but we never send more than 25 images to Claude.
  const pool = candidates.slice(0, MAX_CANDIDATES);

  const allowedRoles = [...rolesForCategories(categories), GENERIC_ROLE];

  const system = [
    "You are a venue photo curator scoring candidate photos for a hospitality directory.",
    "For every numbered image in the user turn, emit one score entry via the `score_photos` tool.",
    "",
    "Scoring rubric — each subscore is 0–100 (integers):",
    "- visual_quality: sharpness, exposure, framing, clutter, readable subject.",
    "- ambiance: how strongly the photo conveys the venue's mood and atmosphere.",
    "- offerings: how clearly it shows what the business sells (food, drinks, gear, rooms).",
    "- brand_fit: how aligned it feels with the venue's identity (luxe vs casual, moody vs bright).",
    "- informational: how much a new guest would learn from the photo (menu items, seating, layout).",
    "- authenticity: natural, professional venue photography vs. promotional overlay, watermark, headshot, or amateur snapshot.",
    "",
    "Hard rejects — any photo matching one of these MUST receive `authenticity` ≤ 15 AND `visual_quality` ≤ 30 so it is filtered out downstream:",
    "- Event flyers, posters, or covers (any image with large promotional text, ticket info, dates, artist lineups, or logo lockups overlaid on the artwork).",
    "- Performer/artist promo portraits, staff headshots, fashion shoots, or editorial press shots not taken inside the venue.",
    "- Amateur or phone-quality snapshots (harsh flash, blurry, badly framed, low resolution, social-media overlays, UI chrome).",
    "- Stock imagery or marketing graphics that don't depict the physical space or its offerings.",
    "Professional on-site photography of the space, food, drinks, interior design, exterior, and genuine guest moments should score normally on authenticity.",
    "",
    "Assign exactly one `role` from the provided enum. Use the most specific role that fits.",
    "If none fit, or if the photo is a hard reject above, assign `generic`.",
    "",
    "Reasoning: one concise sentence naming the image's strongest contribution (or its weakness).",
    "Never use ALL CAPS. Refer to the place as a 'space', not a 'spot'.",
  ].join("\n");

  const userText = [
    `Venue categories: ${categories.join(", ") || "unspecified"}.`,
    `Allowed roles (snake_case enum): ${allowedRoles.join(", ")}.`,
    "Score every image below. Return exactly one entry per image, in any order, keyed by its index.",
  ].join("\n");

  const tool = {
    name: "score_photos",
    description:
      "Emit a scored entry for every candidate image. One entry per image, keyed by the image's index (0-based).",
    input_schema: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer", minimum: 0 },
              role: { type: "string", enum: allowedRoles },
              subscores: {
                type: "object",
                properties: {
                  visual_quality: { type: "integer", minimum: 0, maximum: 100 },
                  ambiance: { type: "integer", minimum: 0, maximum: 100 },
                  offerings: { type: "integer", minimum: 0, maximum: 100 },
                  brand_fit: { type: "integer", minimum: 0, maximum: 100 },
                  informational: { type: "integer", minimum: 0, maximum: 100 },
                  authenticity: { type: "integer", minimum: 0, maximum: 100 },
                },
                required: Object.keys(SCORE_WEIGHTS),
                additionalProperties: false,
              },
              reasoning: { type: "string", minLength: 1, maxLength: 200 },
            },
            required: ["index", "role", "subscores", "reasoning"],
            additionalProperties: false,
          },
        },
      },
      required: ["entries"],
      additionalProperties: false,
    },
  };

  const call = await multimodalToolCall<{
    entries: Array<{
      index: number;
      role: string;
      subscores: Record<SubscoreKey, number>;
      reasoning: string;
    }>;
  }>({
    system,
    userText,
    images: pool.map((c) => ({ url: c.url })),
    tool,
    maxTokens: 4096,
  });

  // Align responses back to input order, even if Claude returned them out
  // of order. If an index is missing (shouldn't happen with forced tool-use
  // but we're defensive), that slot gets a zeroed entry and will be
  // filtered out by the selector's MIN_ROLE_THRESHOLD.
  const byIndex = new Map<number, (typeof call.data.entries)[number]>();
  for (const e of call.data.entries) {
    if (typeof e.index === "number") byIndex.set(e.index, e);
  }

  const scored: ScoredCandidate[] = pool.map((c, i) => {
    const e = byIndex.get(i);
    if (!e) {
      return {
        url: c.url,
        source: c.source,
        role: GENERIC_ROLE,
        subscores: {
          visual_quality: 0,
          ambiance: 0,
          offerings: 0,
          brand_fit: 0,
          informational: 0,
          authenticity: 0,
        },
        composite: 0,
        reasoning: "Scoring skipped — no entry returned for this image.",
      };
    }
    return {
      url: c.url,
      source: c.source,
      role: e.role,
      subscores: e.subscores,
      composite: computeComposite(e.subscores),
      reasoning: e.reasoning,
    };
  });

  return {
    scored,
    tokenCost: estimateSonnetCost(call.usage),
    usage: call.usage,
  };
}

// ---------------------------------------------------------------------------
// Selector (pure function — unit testable without the network)
// ---------------------------------------------------------------------------

/**
 * Pick the best-coverage subset of scored candidates for the given
 * categories. Returns the selection in role-priority order (hero first).
 *
 * Algorithm:
 *   Pass 1: For each required role in importance order, take the highest
 *           composite candidate whose role matches, provided it clears
 *           `MIN_ROLE_THRESHOLD`. Covers the shot list.
 *   Pass 2: Fill to `target` by taking the highest unpicked composites,
 *           subject to a per-role cap so we don't end up with 4 cocktail
 *           shots even if they all score well.
 */
export function selectBalanced(
  scored: ScoredCandidate[],
  categories: string[],
  target: number = TARGET_PHOTO_COUNT,
): ScoredCandidate[] {
  const requiredRoles = rolesForCategories(categories);
  // Importance = position in requiredRoles, lower index == more important.
  const importance = new Map<string, number>();
  requiredRoles.forEach((role, i) => importance.set(role, i));

  // Hard-reject filter: drop event flyers / promo graphics / amateur shots
  // before either pass runs. The scorer is instructed to push these to
  // authenticity ≤ 15; we gate at MIN_AUTHENTICITY so a single soft score
  // doesn't sneak one into publish.
  const eligible = scored.filter((c) => c.subscores.authenticity >= MIN_AUTHENTICITY);

  const byRole = new Map<string, ScoredCandidate[]>();
  for (const c of eligible) {
    const list = byRole.get(c.role) ?? [];
    list.push(c);
    byRole.set(c.role, list);
  }
  // Pre-sort each role's list by composite desc so Pass 1 can pop the best.
  for (const list of byRole.values()) {
    list.sort((a, b) => b.composite - a.composite);
  }

  const selected: ScoredCandidate[] = [];
  const selectedUrls = new Set<string>();

  // Pass 1: cover required roles.
  for (const role of requiredRoles) {
    const candidates = byRole.get(role);
    if (!candidates || candidates.length === 0) continue;
    const best = candidates[0];
    if (best.composite < MIN_ROLE_THRESHOLD) continue;
    selected.push(best);
    selectedUrls.add(best.url);
  }

  // Pass 2: fill to target with remaining best composites, per-role cap 2.
  const remaining = eligible
    .filter((c) => !selectedUrls.has(c.url))
    .sort((a, b) => b.composite - a.composite);
  const perRoleCount = new Map<string, number>();
  for (const c of selected) {
    perRoleCount.set(c.role, (perRoleCount.get(c.role) ?? 0) + 1);
  }
  for (const cand of remaining) {
    if (selected.length >= target) break;
    const n = perRoleCount.get(cand.role) ?? 0;
    if (n >= PER_ROLE_CAP) continue;
    selected.push(cand);
    selectedUrls.add(cand.url);
    perRoleCount.set(cand.role, n + 1);
  }

  // Sort by role importance (required roles first in order), then composite.
  const importanceOf = (role: string) => {
    const idx = importance.get(role);
    return idx === undefined ? Number.MAX_SAFE_INTEGER : idx;
  };
  selected.sort((a, b) => {
    const ia = importanceOf(a.role);
    const ib = importanceOf(b.role);
    if (ia !== ib) return ia - ib;
    return b.composite - a.composite;
  });

  return selected;
}

/** Convenience: roles that SHOULD have been covered but weren't. */
export function coverageGaps(
  selected: ScoredCandidate[],
  categories: string[],
): string[] {
  const needed = new Set(rolesForCategories(categories));
  for (const s of selected) needed.delete(s.role);
  return Array.from(needed);
}

/** Exposed for the API route's initial pool check. */
export { SHOT_LISTS, MIN_ROLE_THRESHOLD, TARGET_PHOTO_COUNT };
