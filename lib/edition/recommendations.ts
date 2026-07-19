/**
 * Food & Drink — Kindred's daily editorial guide to the best local places
 * to eat and drink. Presentation mirrors Local Events and Activities on
 * purpose — same grid, same rhythm, its own editorial voice.
 */

import type { RankedDiscoveryItem } from "./discovery.ts";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { resolveVenueClassification } from "./venueClassification.ts";
import {
  type ReaderLocation,
} from "./localDiscoveryScope.ts";
import {
  foodDrinkSortScore,
  FOOD_DRINK_SECTION_INTRO,
} from "./foodDrinkDesk.ts";
import {
  curateFoodDrinkEdition,
} from "./foodDrinkCuration.ts";
import { foodDrinkCollectionLabel } from "./foodDrinkCollections.ts";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing.ts";
import { prepareFoodDrinkPool } from "./foodDrinkGuide.ts";
import {
  homepageVenueEditorialSortScore,
  VENUE_EDITORIAL_TIER_STRONG,
} from "./venueEditorialScore.ts";
import {
  isLowValueVenue,
  isScenicOrHiddenGem,
  venueHayFromParts,
} from "./venueQuality.ts";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon.ts";

export {
  FOOD_DRINK_SECTION_INTRO,
  FOOD_DRINK_SECTION_KICKER,
  FOOD_DRINK_SECTION_TITLE,
  FOOD_DRINK_SECTION_QUESTION,
  FOOD_DRINK_SEE_ALL_LABEL,
} from "./foodDrinkDesk.ts";

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

const CATEGORY_LABEL: Record<string, string> = {
  coffee: "Coffee",
  restaurants: "Restaurant",
  bakeries: "Bakery",
};

export function recommendationCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

function recommendationSortScore(
  d: RankedDiscoveryItem,
  editionDate?: string | null
): number {
  const editorial = d.item.venueEditorial?.score;
  if (typeof editorial === "number" && editorial > 0) {
    const venueId =
      d.item.venueEditorial?.kindredVenueId ?? d.item.id;
    const base =
      editionDate != null
        ? homepageVenueEditorialSortScore(editorial, venueId, editionDate)
        : editorial;
    let s = base;
    const hay = venueHayFromParts([
      d.item.title,
      d.item.dek,
      ...(d.item.venueCategories ?? []),
      d.item.address,
    ]);
    if (isScenicOrHiddenGem(hay)) s += 3;
    if (isLowValueVenue(hay)) s -= 20;
    if (d.item.tags?.includes("chain")) s -= 8;
    return s;
  }

  let s = foodDrinkSortScore(d);
  const hay = venueHayFromParts([
    d.item.title,
    d.item.dek,
    ...(d.item.venueCategories ?? []),
    d.item.address,
  ]);
  if (isScenicOrHiddenGem(hay)) s += 4;
  if (isLowValueVenue(hay)) s -= 20;
  return s;
}

function recommendationOverline(item: RankedDiscoveryItem["item"]): string {
  return foodDrinkCollectionLabel(item);
}

export function selectRecommendationCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: {
    city?: string | null;
    readerLocation?: ReaderLocation | null;
    /** @deprecated Use selectHomepageRecommendationCards or organizeFoodDrinkGuide */
    mode?: "homepage" | "guide";
  }
): EditorialGridCard[] {
  if (options?.mode === "guide") {
    const pool = prepareFoodDrinkPool(items, options);
    return pool.map((d) => toRecommendationCard(d, options?.city));
  }
  return selectHomepageRecommendationCards(items, options);
}

/** Homepage front page — exactly 8 featured experiences, no cuisine repeat. */
export function selectHomepageRecommendationCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: {
    city?: string | null;
    readerLocation?: ReaderLocation | null;
    editionDate?: string | null;
  }
): EditorialGridCard[] {
  const readerLocation = options?.readerLocation ?? null;
  const editionDate = options?.editionDate ?? null;
  const pool = prepareFoodDrinkPool(items, { readerLocation }).filter((d) => {
    const score = d.item.venueEditorial?.score;
    if (typeof score === "number" && score > 0 && score < VENUE_EDITORIAL_TIER_STRONG - 10) {
      return false;
    }
    return true;
  });

  const ranked = curateFoodDrinkEdition(pool, {
    getScore: (d) => recommendationSortScore(d, editionDate),
    depth: HOMEPAGE_INITIAL_RENDER_COUNT,
    maxPerFingerprint: 1,
    repeatScoreGap: Number.POSITIVE_INFINITY,
  });

  return ranked
    .slice(0, HOMEPAGE_INITIAL_RENDER_COUNT)
    .map((d) => toRecommendationCard(d, options?.city));
}

/** When card selection yields zero but desk items exist, still paint the section. */
export function buildFallbackHomepageFoodDrinkCards(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; limit?: number }
): EditorialGridCard[] {
  const limit = options?.limit ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  return (items ?? [])
    .filter((d) => d.item.title?.trim())
    .slice(0, limit)
    .map((d) => toRecommendationCard(d, options?.city));
}

function toRecommendationCard(
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
      overline: recommendationOverline(d.item),
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

export function recommendationLocationLine(
  item: RankedDiscoveryItem["item"],
  fallbackCity?: string | null
): string | null {
  if (item.address?.trim()) return item.address.trim();
  const city = item.place?.city?.trim() || fallbackCity?.trim();
  return city || null;
}

export function recommendationNote(
  item: RankedDiscoveryItem["item"]
): string | null {
  const dek = item.dek?.trim();
  if (!dek) return null;
  if (dek === item.title.trim()) return null;
  return dek;
}
