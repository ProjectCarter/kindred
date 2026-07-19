/**
 * Food & Drink guide — complete editorial dining guide organized by collection.
 * No artificial publication cap; quality and radius determine the total.
 */

import type { RankedDiscoveryItem } from "./discovery.ts";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import {
  FOOD_DRINK_GUIDE_COLLECTIONS,
  foodDrinkCollectionLabel,
  inferFoodDrinkCollection,
  type FoodDrinkCollectionId,
} from "./foodDrinkCollections.ts";
import { foodDrinkSortScore } from "./foodDrinkDesk.ts";
import {
  compareVenueEditorialRank,
} from "./venueEditorialScore.ts";
import {
  compareByLocalProximity,
  type ReaderLocation,
} from "./localDiscoveryScope.ts";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon.ts";
import { resolveVenueClassification } from "./venueClassification.ts";
import { buildFoodDrinkGuidePool } from "./foodDrinkSeeAll.ts";

function recommendationLocationLine(
  item: RankedDiscoveryItem["item"],
  fallbackCity?: string | null
): string | null {
  if (item.address?.trim()) return item.address.trim();
  const city = item.place?.city?.trim() || fallbackCity?.trim();
  return city || null;
}

function recommendationNote(item: RankedDiscoveryItem["item"]): string | null {
  const dek = item.dek?.trim();
  if (!dek) return null;
  if (dek === item.title.trim()) return null;
  return dek;
}

export type FoodDrinkGuideSection = {
  id: string;
  label: string;
  icon: string;
  cards: EditorialGridCard[];
};

/** @deprecated Use FOOD_DRINK_GUIDE_COLLECTIONS */
export const FOOD_DRINK_GUIDE_SECTIONS = FOOD_DRINK_GUIDE_COLLECTIONS;

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

function toGuideCard(
  d: RankedDiscoveryItem,
  city?: string | null
): EditorialGridCard {
  const venue = resolveVenueClassification({
    title: d.item.title,
    venueCategories: d.item.venueCategories,
    discoveryCategory: d.item.category,
    dek: d.item.dek,
  });
  return {
    id: d.item.id,
    overline: foodDrinkCollectionLabel(d.item),
    categoryIcon: resolveDiscoveryCategoryIcon(
      {
        title: d.item.title,
        dek: d.item.dek,
        category: d.item.category,
        venueCategories: d.item.venueCategories,
        tags: d.item.tags,
        editorialCategoryId:
          venue.confidence !== "low" ? venue.categoryId : null,
      },
      "recommendation"
    ),
    title: d.item.title.trim(),
    subtitle: recommendationLocationLine(d.item, city),
    note: recommendationNote(d.item),
  };
}

export function prepareFoodDrinkPool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { readerLocation?: ReaderLocation | null }
): RankedDiscoveryItem[] {
  return buildFoodDrinkGuidePool(items, options?.readerLocation ?? null);
}

export function organizeFoodDrinkGuide(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): FoodDrinkGuideSection[] {
  const pool = prepareFoodDrinkPool(items, options);
  if (!pool.length) return [];

  const byCollection = new Map<FoodDrinkCollectionId, RankedDiscoveryItem[]>();
  for (const def of FOOD_DRINK_GUIDE_COLLECTIONS) {
    byCollection.set(def.id, []);
  }

  for (const item of pool) {
    const collectionId = inferFoodDrinkCollection(item.item);
    byCollection.get(collectionId)?.push(item);
  }

  const sections: FoodDrinkGuideSection[] = [];

  for (const def of FOOD_DRINK_GUIDE_COLLECTIONS) {
    const rows = (byCollection.get(def.id) ?? []).sort((a, b) =>
      guideRankCompare(a, b, options?.readerLocation ?? null)
    );
    if (!rows.length) continue;

    sections.push({
      id: def.id,
      label: def.label,
      icon: def.icon,
      cards: rows.map((row) => toGuideCard(row, options?.city)),
    });
  }

  return sections;
}

/** Total qualifying places across all guide sections. */
export function foodDrinkGuidePlaceCount(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { readerLocation?: ReaderLocation | null }
): number {
  return prepareFoodDrinkPool(items, options).length;
}
