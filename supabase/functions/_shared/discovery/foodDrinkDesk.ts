/**
 * Server mirror — lib/edition/foodDrinkDesk.ts
 */

import type { DiscoveryCategory, RankedDiscoveryItem } from "./types.ts";
import { venueHayFromParts } from "../editorial/venueQuality.ts";

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
