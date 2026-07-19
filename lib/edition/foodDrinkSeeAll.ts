/**
 * Food & Drinks See All — one pool and one count for homepage footer + full list.
 * Single source for prepareFoodDrinkPool / organizeFoodDrinkGuide filtering.
 */

import type { RankedDiscoveryItem } from "./discovery.ts";
import {
  applyLocalFirstFoodBalance,
  foodDrinkSortScore,
  isGuideEligibleVenueEditorial,
} from "./foodDrinkDesk.ts";
import {
  compareByLocalProximity,
  isWithinLocalDiscoveryRadius,
  RECOMMENDATION_CATEGORIES,
  type ReaderLocation,
} from "./localDiscoveryScope.ts";
import { compareVenueEditorialRank } from "./venueEditorialScore.ts";

export type FoodDrinkSeeAllExclusion = {
  id: string;
  title: string;
  reason:
    | "not_food_category"
    | "below_guide_editorial_minimum"
    | "outside_radius"
    | "missing_title"
    | "duplicate_id";
};

export type FoodDrinkSeeAllAnalysis = {
  pool: RankedDiscoveryItem[];
  uniqueBeforeFilter: number;
  uniqueAfterFilter: number;
  exclusions: FoodDrinkSeeAllExclusion[];
};

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

function dedupeById(
  items: readonly RankedDiscoveryItem[]
): RankedDiscoveryItem[] {
  const seen = new Set<string>();
  const out: RankedDiscoveryItem[] = [];
  for (const item of items) {
    const id = item.item.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function venueEditorialScoreOf(d: RankedDiscoveryItem): number {
  return d.item.venueEditorial?.score ?? foodDrinkSortScore(d);
}

function guideRankCompare(
  a: RankedDiscoveryItem,
  b: RankedDiscoveryItem,
  readerLocation: ReaderLocation | null
): number {
  const editorialDiff = compareVenueEditorialRank(
    {
      editorialScore: venueEditorialScoreOf(a),
      confidenceScore: a.item.editorialConfidence?.score,
    },
    {
      editorialScore: venueEditorialScoreOf(b),
      confidenceScore: b.item.editorialConfidence?.score,
    }
  );
  if (editorialDiff !== 0) return editorialDiff;
  const proximity = compareByLocalProximity(a, b, readerLocation);
  if (proximity !== 0) return proximity;
  return foodDrinkSortScore(b) - foodDrinkSortScore(a);
}

/** Shared pool builder for See All count, handoff, and full guide. */
export function buildFoodDrinkGuidePool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  readerLocation?: ReaderLocation | null
): RankedDiscoveryItem[] {
  return applyLocalFirstFoodBalance(
    dedupeById(items ?? [])
      .filter((d) => RECOMMENDATION_CATEGORIES.has(d.item.category))
      .filter(isGuideEligibleVenueEditorial)
      .filter((d) => isWithinLocalDiscoveryRadius(d, readerLocation))
      .filter((d) => isCompleteCard(d.item))
      .sort((a, b) => guideRankCompare(a, b, readerLocation ?? null))
  );
}

/** Same eligibility as the full Food & Drinks guide screen. */
export function analyzeFoodDrinkSeeAllPool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  readerLocation?: ReaderLocation | null
): FoodDrinkSeeAllAnalysis {
  const uniqueBeforeFilter = dedupeById(items ?? []).length;
  const exclusions: FoodDrinkSeeAllExclusion[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    const id = item.item.id;
    const title = item.item.title?.trim() || id;
    if (!id) continue;
    if (seen.has(id)) {
      exclusions.push({ id, title, reason: "duplicate_id" });
      continue;
    }
    seen.add(id);

    if (!RECOMMENDATION_CATEGORIES.has(item.item.category)) {
      exclusions.push({ id, title, reason: "not_food_category" });
      continue;
    }
    if (!isGuideEligibleVenueEditorial(item)) {
      exclusions.push({ id, title, reason: "below_guide_editorial_minimum" });
      continue;
    }
    if (!isWithinLocalDiscoveryRadius(item, readerLocation)) {
      exclusions.push({ id, title, reason: "outside_radius" });
      continue;
    }
    if (!isCompleteCard(item.item)) {
      exclusions.push({ id, title, reason: "missing_title" });
      continue;
    }
  }

  const pool = buildFoodDrinkGuidePool(items, readerLocation);
  return {
    pool,
    uniqueBeforeFilter,
    uniqueAfterFilter: pool.length,
    exclusions,
  };
}

export function resolveFoodDrinkSeeAllPool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  readerLocation?: ReaderLocation | null
): RankedDiscoveryItem[] {
  return analyzeFoodDrinkSeeAllPool(items, readerLocation).pool;
}

export function foodDrinkSeeAllCount(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  readerLocation?: ReaderLocation | null
): number {
  return resolveFoodDrinkSeeAllPool(items, readerLocation).length;
}

export type FoodDrinkCountDebugPayload = {
  stage: string;
  generatedCount?: number | null;
  sectionRowCount?: number | null;
  cacheCount?: number | null;
  uniqueBeforeFilter?: number | null;
  uniqueAfterFilter?: number | null;
  homepageCount?: number | null;
  fullListHandoffCount?: number | null;
  renderedCount?: number | null;
  paginationLimit?: number | null;
  exclusions?: FoodDrinkSeeAllExclusion[];
};

export function logFoodDrinkCountDebug(
  payload: FoodDrinkCountDebugPayload
): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  console.log("[foodDrinks:count-debug]", payload);
}

export function countRenderedFoodDrinkGuideCards(
  sections: ReadonlyArray<{ cards: ReadonlyArray<{ id: string }> }>
): number {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const card of section.cards) {
      if (card.id) ids.add(card.id);
    }
  }
  return ids.size;
}
