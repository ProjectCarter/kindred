/**
 * Food & Drink desk — Kindred's daily editorial guide to the best local
 * places to eat and drink. Not a directory; curated, local-first.
 */

import type { DiscoveryCategory, RankedDiscoveryItem } from "./discovery";
import { venueHayFromParts } from "./venueQuality";
import { VENUE_EDITORIAL_TIER_GUIDE_MIN } from "./venueEditorialScore";

export const FOOD_DRINK_SECTION_KICKER = "🍽️ Food & Drink";
export const FOOD_DRINK_SECTION_TITLE = "Food & Drink";
export const FOOD_DRINK_SECTION_QUESTION = "Where should I eat and drink?";
export const FOOD_DRINK_SECTION_INTRO =
  "Kindred's curated local dining guide — up to 20 editor-selected places within 25 miles.";
export const FOOD_DRINK_SEE_ALL_LABEL = (count: number) =>
  `See all ${count} places`;

/** Target 80–90% independently owned; chains capped at 20% of published picks. */
export const FOOD_DRINK_MAX_CHAIN_SHARE = 0.2;

export const FOOD_DRINK_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "restaurants",
  "coffee",
  "bakeries",
]);

/** @deprecated Internal key — same pool as Food & Drink desk. */
export const RECOMMENDATION_CATEGORIES = FOOD_DRINK_CATEGORIES;

export const DESTINATION_ACTIVITY_CATEGORIES: ReadonlySet<DiscoveryCategory> =
  new Set(["museums", "parks", "beaches", "gardens", "scenic_drives"]);

const FOOD_ESTABLISHMENT_PATTERN =
  /\b(restaurant|cafe|café|coffee\s+shop|bakery|brewery|winery|wine\s+bar|cocktail\s+bar|sports\s+bar|pizzeria|pizza|sushi|bbq|barbecue|burger|diner|bistro|brunch|food\s+truck|ice\s+cream|donut|doughnut|dessert\s+shop|tavern|pub\b|grill\b|eatery|cantina|taco|ramen|noodle\s+house|steakhouse|seafood\s+house|juice\s+bar|bagel|patisserie|gelato|cupcake|catering)\b/i;

export function isFoodDrinkCategory(
  category: DiscoveryCategory | string
): boolean {
  return FOOD_DRINK_CATEGORIES.has(category as DiscoveryCategory);
}

export function isFoodEstablishmentItem(item: RankedDiscoveryItem): boolean {
  if (isFoodDrinkCategory(item.item.category)) return true;
  const hay = venueHayFromParts([
    item.item.title,
    item.item.dek,
    ...(item.item.venueCategories ?? []),
    item.item.address,
  ]);
  return FOOD_ESTABLISHMENT_PATTERN.test(hay);
}

export function foodDrinkSortScore(d: RankedDiscoveryItem): number {
  const editorial = d.item.venueEditorial?.score;
  if (typeof editorial === "number" && editorial > 0) {
    let s = editorial;
    if (d.surfaces.includes("hidden_gems")) s += 4;
    if (d.item.tags?.includes("hidden_gem")) s += 3;
    if (d.item.tags?.includes("local_place") && !d.item.tags?.includes("chain")) {
      s += 6;
    }
    if (d.item.tags?.includes("chain")) s -= 10;
    return s;
  }

  let s = d.score ?? 0;
  if (d.surfaces.includes("hidden_gems")) s += 6;
  if (d.item.tags?.includes("hidden_gem")) s += 4;
  if (d.item.tags?.includes("local_place") && !d.item.tags?.includes("chain")) {
    s += 14;
  }
  if (d.item.tags?.includes("chain")) s -= 28;
  return s;
}

/** Guide pool — exclude venues below editorial guide minimum. */
export function isGuideEligibleVenueEditorial(d: RankedDiscoveryItem): boolean {
  const editorial = d.item.venueEditorial?.score;
  if (typeof editorial !== "number") return true;
  return editorial >= VENUE_EDITORIAL_TIER_GUIDE_MIN;
}

/** Cap national chains so local independents lead the desk (80–90% local target). */
export function applyLocalFirstFoodBalance(
  ranked: RankedDiscoveryItem[]
): RankedDiscoveryItem[] {
  if (ranked.length <= 2) return ranked;

  const maxChains = Math.max(
    1,
    Math.floor(ranked.length * FOOD_DRINK_MAX_CHAIN_SHARE)
  );
  const locals: RankedDiscoveryItem[] = [];
  const chains: RankedDiscoveryItem[] = [];

  for (const item of ranked) {
    if (item.item.tags?.includes("chain")) chains.push(item);
    else locals.push(item);
  }

  const keptChains = chains.slice(0, maxChains);
  const deferredChains = chains.slice(maxChains);
  return [...locals, ...keptChains, ...deferredChains];
}
