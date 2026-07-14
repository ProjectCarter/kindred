/**
 * Recommendations — Kindred's "where should I go?" desk.
 * Places worth discovering: coffee, restaurants, bakeries, beaches, parks,
 * museums, scenic drives, gardens. Presentation mirrors Local Events and
 * Activities on purpose — same grid, same rhythm, its own editorial voice.
 * (This replaces the earlier text-list "From the desk" design; recipes
 * moved to Bandit's Notebook, where "a personal find, not a place" already
 * lives — see sectionAllocator.ts.)
 */

import type { ImageSourcePropType } from "react-native";
import type { DiscoveryCategory, RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { claimImage, NEUTRAL_PLACEHOLDERS } from "./imageRegistry";
import { categoryImageIsConfident } from "./imageConfidence";

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

const CATEGORY_PHOTOS: Record<string, ImageSourcePropType[]> = {
  coffee: [require("../../assets/heroes/hero-default-morning.jpg")],
  restaurants: [require("../../assets/discovery/recommendation-restaurant.jpg")],
  bakeries: [require("../../assets/discovery/recommendation-bakery.jpg")],
  beaches: [require("../../assets/heroes/hero-beach-morning.jpg")],
  parks: [
    require("../../assets/heroes/hero-spring-flowers.jpg"),
    require("../../assets/heroes/hero-summer-sunrise.jpg"),
  ],
  museums: [require("../../assets/heroes/hero-city-sunrise.jpg")],
  scenic_drives: [
    require("../../assets/heroes/hero-summer-sunrise.jpg"),
    require("../../assets/heroes/hero-mountain-morning.jpg"),
  ],
  gardens: [require("../../assets/discovery/recommendation-garden.jpg")],
};

const FALLBACK_PHOTOS: ImageSourcePropType[] = NEUTRAL_PLACEHOLDERS;

export function recommendationCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

/**
 * Assign a photo per card — each card's own category pool when the venue's
 * own text actually corroborates that category (accuracy over a beautiful
 * guess), a tasteful neutral photo otherwise, deduped across the *entire*
 * edition via the shared image registry (not just this section) and
 * stable across re-renders for the same item.
 */
function assignRecommendationImages(
  items: RankedDiscoveryItem[]
): ImageSourcePropType[] {
  return items.map((d) => {
    const confident = categoryImageIsConfident(d.item.category, d.item);
    const pool = confident
      ? CATEGORY_PHOTOS[d.item.category] ?? FALLBACK_PHOTOS
      : NEUTRAL_PLACEHOLDERS;
    return claimImage(d.item.id, pool);
  });
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

function recommendationSortScore(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (d.surfaces.includes("hidden_gems")) s += 3;
  return s;
}

const RECOMMENDATION_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "coffee",
  "restaurants",
  "bakeries",
  "beaches",
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
]);

function isRecommendationItem(d: RankedDiscoveryItem): boolean {
  return RECOMMENDATION_CATEGORIES.has(d.item.category);
}

export function selectRecommendationCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null }
): EditorialGridCard[] {
  const ranked = [...(items ?? [])]
    .filter(isRecommendationItem)
    .filter((d) => isCompleteCard(d.item))
    .sort((a, b) => recommendationSortScore(b) - recommendationSortScore(a));
  const images = assignRecommendationImages(ranked);

  return ranked.map((d, i) => ({
    id: d.item.id,
    image: images[i],
    overline: recommendationCategoryLabel(d.item.category),
    title: d.item.title.trim(),
    subtitle: recommendationLocationLine(d.item, options?.city),
    note: recommendationNote(d.item),
  }));
}
