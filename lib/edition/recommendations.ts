/**
 * Recommendations — Kindred's "where should I go?" desk.
 * Places worth discovering: coffee, restaurants, bakeries, beaches, parks,
 * museums, scenic drives, gardens. Presentation mirrors Local Events and
 * Activities on purpose — same grid, same rhythm, its own editorial voice.
 * (This replaces the earlier text-list "From the desk" design; recipes
 * moved to Bandit's Notebook, where "a personal find, not a place" already
 * lives — see sectionAllocator.ts.)
 */

import type { RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { resolveListingActionsForDiscoveryItem } from "./actionBar";
import { resolveVenueClassification } from "./venueClassification";
import {
  compareByLocalProximity,
  isWithinLocalDiscoveryRadius,
  RECOMMENDATION_CATEGORIES,
  type ReaderLocation,
} from "./localDiscoveryScope";
import {
  isLowValueVenue,
  isScenicOrHiddenGem,
  venueHayFromParts,
} from "./venueQuality";

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

const CATEGORY_LABEL: Record<string, string> = {
  coffee: "Coffee",
  restaurants: "Restaurant",
  bakeries: "Bakery",
  beaches: "Beach",
  parks: "Park",
  museums: "Museum",
  scenic_drives: "Scenic Drive",
  gardens: "Garden",
};

export function recommendationCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

function isRecommendationItem(d: RankedDiscoveryItem): boolean {
  return RECOMMENDATION_CATEGORIES.has(d.item.category);
}

function recommendationSortScore(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (d.surfaces.includes("hidden_gems")) s += 6;
  if (d.item.tags?.includes("hidden_gem")) s += 4;
  if (d.item.tags?.includes("chain")) s -= 8;
  const hay = venueHayFromParts([
    d.item.title,
    d.item.dek,
    ...(d.item.venueCategories ?? []),
    d.item.address,
  ]);
  if (isScenicOrHiddenGem(hay)) s += 6;
  if (isLowValueVenue(hay)) s -= 20;
  return s;
}

function recommendationOverline(item: RankedDiscoveryItem["item"]): string {
  if (item.tags?.includes("local_place")) {
    const venue = resolveVenueClassification({
      title: item.title,
      venueCategories: item.venueCategories,
      discoveryCategory: item.category,
      dek: item.dek,
    });
    if (venue.confidence !== "low") {
      const label = venue.displayLabel;
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  return recommendationCategoryLabel(item.category);
}

export function selectRecommendationCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): EditorialGridCard[] {
  const readerLocation = options?.readerLocation ?? null;
  const ranked = [...(items ?? [])]
    .filter(isRecommendationItem)
    .filter((d) => isWithinLocalDiscoveryRadius(d, readerLocation))
    .filter((d) => isCompleteCard(d.item))
    .sort((a, b) => {
      const proximity = compareByLocalProximity(a, b, readerLocation);
      if (proximity !== 0) return proximity;
      return recommendationSortScore(b) - recommendationSortScore(a);
    });

  return ranked.map((d) => ({
    id: d.item.id,
    overline: recommendationOverline(d.item),
    title: d.item.title.trim(),
    subtitle: recommendationLocationLine(d.item, options?.city),
    note: recommendationNote(d.item),
    actions: resolveListingActionsForDiscoveryItem(d.item, {
      fallbackCity: options?.city,
      surface: "recommendation",
    }),
  }));
}

export function recommendationLocationLine(
  item: RankedDiscoveryItem["item"],
  fallbackCity?: string | null
): string | null {
  if (item.address?.trim()) return item.address.trim();
  const city = item.place?.city?.trim() || fallbackCity?.trim();
  return city || null;
}

/** Real venues already carry Kindred's own AI-written note (places/notes.ts) — use it as-is. */
export function recommendationNote(item: RankedDiscoveryItem["item"]): string | null {
  const dek = item.dek?.trim();
  if (!dek) return null;
  if (dek === item.title.trim()) return null;
  return dek;
}

