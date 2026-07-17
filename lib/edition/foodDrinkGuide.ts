/**
 * Food & Drink guide — complete editorial dining guide organized by category.
 * No artificial publication cap; quality and radius determine the total.
 */

import type { RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import {
  inferFoodEditorFingerprint,
  foodEditorFingerprintLabel,
  type FoodEditorFingerprint,
} from "./foodDrinkCuration";
import {
  applyLocalFirstFoodBalance,
  foodDrinkSortScore,
  isGuideEligibleVenueEditorial,
} from "./foodDrinkDesk";
import {
  compareVenueEditorialRank,
  VENUE_EDITORIAL_TIER_SIGNATURE,
} from "./venueEditorialScore";
import {
  compareByLocalProximity,
  isWithinLocalDiscoveryRadius,
  RECOMMENDATION_CATEGORIES,
  type ReaderLocation,
} from "./localDiscoveryScope";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon";
import { resolveVenueClassification } from "./venueClassification";
import { venueHayFromParts } from "./venueQuality";

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

type GuideSectionDef = {
  id: string;
  label: string;
  icon: string;
  /** Primary fingerprint buckets — items land in the first matching section. */
  fingerprints?: readonly FoodEditorFingerprint[];
  /** Spotlight sections — items may also appear in a primary category below. */
  spotlight?: "editors_picks" | "hidden_gems" | "dog_friendly";
};

/** Editorial category order for the complete dining guide. */
export const FOOD_DRINK_GUIDE_SECTIONS: readonly GuideSectionDef[] = [
  { id: "editors_picks", label: "Editor's Picks", icon: "⭐", spotlight: "editors_picks" },
  { id: "hidden_gems", label: "Hidden Gems", icon: "💎", spotlight: "hidden_gems" },
  { id: "coffee", label: "Coffee", icon: "☕", fingerprints: ["coffee_shop"] },
  { id: "bakery", label: "Bakery", icon: "🥐", fingerprints: ["bakery", "donuts"] },
  { id: "breakfast", label: "Breakfast", icon: "🍳", fingerprints: ["breakfast"] },
  { id: "lunch", label: "Lunch", icon: "🥪", fingerprints: ["lunch"] },
  { id: "burgers", label: "Burgers", icon: "🍔", fingerprints: ["burgers"] },
  { id: "mexican", label: "Mexican", icon: "🌮", fingerprints: ["mexican"] },
  { id: "pizza", label: "Pizza", icon: "🍕", fingerprints: ["pizza"] },
  { id: "italian", label: "Italian", icon: "🍝", fingerprints: ["italian"] },
  { id: "sushi", label: "Sushi", icon: "🍣", fingerprints: ["sushi"] },
  { id: "steakhouse", label: "Steakhouses", icon: "🥩", fingerprints: ["steakhouse"] },
  { id: "healthy", label: "Healthy", icon: "🥗", fingerprints: ["healthy_cafe"] },
  { id: "mediterranean", label: "Mediterranean", icon: "🥙", fingerprints: ["mediterranean"] },
  { id: "asian", label: "Asian", icon: "🍜", fingerprints: ["asian"] },
  { id: "brewery", label: "Breweries", icon: "🍺", fingerprints: ["brewery"] },
  { id: "wine_bar", label: "Wine Bars", icon: "🍷", fingerprints: ["wine_bar", "cocktail_bar"] },
  { id: "dessert", label: "Dessert", icon: "🍰", fingerprints: ["dessert_shop"] },
  { id: "ice_cream", label: "Ice Cream", icon: "🍦", fingerprints: ["ice_cream"] },
  { id: "vegetarian", label: "Vegetarian", icon: "🌱", fingerprints: ["vegetarian"] },
  { id: "bbq", label: "BBQ", icon: "🍖", fingerprints: ["bbq"] },
  { id: "dinner", label: "Dinner", icon: "🍽️", fingerprints: ["dinner", "general_restaurant", "food_truck"] },
  { id: "dog_friendly", label: "Dog Friendly", icon: "🐶", spotlight: "dog_friendly" },
] as const;

const EDITORS_PICK_MIN_SCORE = VENUE_EDITORIAL_TIER_SIGNATURE;
const EDITORS_PICK_CAP = 12;

function isFoodDrinkItem(d: RankedDiscoveryItem): boolean {
  return RECOMMENDATION_CATEGORIES.has(d.item.category);
}

function venueEditorialScoreOf(d: RankedDiscoveryItem): number {
  return d.item.venueEditorial?.score ?? foodDrinkSortScore(d);
}

function guideSortScore(d: RankedDiscoveryItem): number {
  return foodDrinkSortScore(d);
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
  return guideSortScore(b) - guideSortScore(a);
}

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

function isHiddenGemItem(d: RankedDiscoveryItem): boolean {
  return (
    d.item.venueEditorial?.labels?.includes("hidden_gem") ||
    d.surfaces.includes("hidden_gems") ||
    Boolean(d.item.tags?.includes("hidden_gem"))
  );
}

function isDogFriendlyItem(d: RankedDiscoveryItem): boolean {
  const hay = venueHayFromParts([
    d.item.title,
    d.item.dek,
    ...(d.item.venueCategories ?? []),
    d.item.address,
  ]);
  return (
    Boolean(d.item.tags?.includes("pet_friendly")) ||
    /\bdog friendly|dog-friendly|patio dogs|pets welcome\b/i.test(hay)
  );
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
    overline: foodEditorFingerprintLabel(d.item),
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

function primarySectionIdForItem(item: RankedDiscoveryItem): string {
  const fp = inferFoodEditorFingerprint(item.item);
  for (const section of FOOD_DRINK_GUIDE_SECTIONS) {
    if (section.fingerprints?.includes(fp)) return section.id;
  }
  return "dinner";
}

export function prepareFoodDrinkPool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { readerLocation?: ReaderLocation | null }
): RankedDiscoveryItem[] {
  const readerLocation = options?.readerLocation ?? null;
  return applyLocalFirstFoodBalance(
    [...(items ?? [])]
      .filter(isFoodDrinkItem)
      .filter(isGuideEligibleVenueEditorial)
      .filter((d) => isWithinLocalDiscoveryRadius(d, readerLocation))
      .filter((d) => isCompleteCard(d.item))
      .sort((a, b) => guideRankCompare(a, b, readerLocation))
  );
}

export function organizeFoodDrinkGuide(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): FoodDrinkGuideSection[] {
  const pool = prepareFoodDrinkPool(items, options);
  if (!pool.length) return [];

  const byPrimary = new Map<string, RankedDiscoveryItem[]>();
  for (const section of FOOD_DRINK_GUIDE_SECTIONS) {
    if (section.fingerprints) byPrimary.set(section.id, []);
  }

  for (const item of pool) {
    const sectionId = primarySectionIdForItem(item);
    const bucket = byPrimary.get(sectionId) ?? byPrimary.get("dinner")!;
    bucket.push(item);
  }

  const editorsPicks = pool
    .filter(
      (d) =>
        venueEditorialScoreOf(d) >= EDITORS_PICK_MIN_SCORE &&
        (d.item.venueEditorial?.labels?.includes("editors_pick") ||
          venueEditorialScoreOf(d) >= EDITORS_PICK_MIN_SCORE)
    )
    .sort((a, b) => guideRankCompare(a, b, options?.readerLocation ?? null))
    .slice(0, EDITORS_PICK_CAP);

  const hiddenGems = pool
    .filter(isHiddenGemItem)
    .sort((a, b) => guideRankCompare(a, b, options?.readerLocation ?? null));
  const dogFriendly = pool
    .filter(isDogFriendlyItem)
    .sort((a, b) => guideRankCompare(a, b, options?.readerLocation ?? null));

  const sections: FoodDrinkGuideSection[] = [];

  for (const def of FOOD_DRINK_GUIDE_SECTIONS) {
    let rows: RankedDiscoveryItem[] = [];
    if (def.spotlight === "editors_picks") rows = editorsPicks;
    else if (def.spotlight === "hidden_gems") rows = hiddenGems;
    else if (def.spotlight === "dog_friendly") rows = dogFriendly;
    else rows = (byPrimary.get(def.id) ?? []).sort((a, b) =>
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

/** Total qualifying places across all guide sections (primary categories only). */
export function foodDrinkGuidePlaceCount(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { readerLocation?: ReaderLocation | null }
): number {
  return prepareFoodDrinkPool(items, options).length;
}
