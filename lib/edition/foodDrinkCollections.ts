/**
 * Food & Drinks editorial collections — Version 1.
 * Seven buckets only; accuracy over forced specialty placement.
 */

import type { DiscoveryCategory, RankedDiscoveryItem } from "./discovery.ts";
import { resolveVenueClassification } from "./venueClassification.ts";
import { venueHayFromParts } from "./venueQuality.ts";

export type FoodDrinkCollectionId =
  | "mexican"
  | "asian"
  | "pizza"
  | "coffee_cafes"
  | "breweries_wine"
  | "desserts_bakeries"
  | "restaurants";

export type FoodDrinkCollectionDef = {
  id: FoodDrinkCollectionId;
  label: string;
  icon: string;
};

/** Display order on the full Food & Drinks guide. */
export const FOOD_DRINK_GUIDE_COLLECTIONS: readonly FoodDrinkCollectionDef[] = [
  { id: "restaurants", label: "Restaurants", icon: "🍽️" },
  { id: "mexican", label: "Mexican", icon: "🌮" },
  { id: "asian", label: "Asian", icon: "🍣" },
  { id: "pizza", label: "Pizza", icon: "🍕" },
  { id: "coffee_cafes", label: "Coffee & Cafés", icon: "☕" },
  {
    id: "breweries_wine",
    label: "Breweries & Wine Bars",
    icon: "🍺🍷",
  },
  {
    id: "desserts_bakeries",
    label: "Desserts & Bakeries",
    icon: "🍰",
  },
] as const;

/** Homepage variety spread — specialty first, default last. */
export const FOOD_DRINK_COLLECTION_SPREAD_ORDER: readonly FoodDrinkCollectionId[] =
  [
    "mexican",
    "asian",
    "pizza",
    "coffee_cafes",
    "breweries_wine",
    "desserts_bakeries",
    "restaurants",
  ];

export const FOOD_DRINK_COLLECTION_LABEL: Record<FoodDrinkCollectionId, string> =
  {
    restaurants: "Restaurant",
    mexican: "Mexican",
    asian: "Asian",
    pizza: "Pizza",
    coffee_cafes: "Coffee & Café",
    breweries_wine: "Brewery & Wine Bar",
    desserts_bakeries: "Dessert & Bakery",
  };

type SpecialtyMatch = {
  collection: FoodDrinkCollectionId;
  confidence: "high" | "low";
};

const MEXICAN_HIGH =
  /\b(mexican|taqueria|taquería|cantina|mexicana)\b/i;
const MEXICAN_MEDIUM = /\b(taco shop|taco bar|burrito bar)\b/i;

const ASIAN_HIGH =
  /\b(sushi|sashimi|ramen|pho|dim sum|izakaya|omakase|nigiri|udon|bento|yakitori|teppanyaki|thai restaurant|vietnamese|korean bbq|korean restaurant|chinese restaurant|japanese restaurant|japan(?:ese)?\s+kitchen|thai kitchen|vietnamese kitchen|korean kitchen|chinese kitchen|pad thai|tom yum|banh mi|bibimbap|dumpling house|noodle house)\b/i;

const PIZZA_HIGH = /\b(pizza|pizzeria)\b/i;

const COFFEE_HIGH =
  /\b(coffee shop|coffee house|espresso bar|coffee roaster|café|cafe\b)\b/i;

const BREWERY_WINE_HIGH =
  /\b(brewery|brewpub|taproom|craft beer|winery|vineyard|wine bar|wine tasting)\b/i;

const DESSERT_BAKERY_HIGH =
  /\b(bakery|bake shop|patisserie|ice cream|gelato|donut shop|doughnut shop|cupcake shop|dessert shop|cake shop|sweet shop|chocolatier)\b/i;

function itemHay(item: RankedDiscoveryItem["item"]): string {
  return venueHayFromParts([
    item.title,
    item.dek,
    ...(item.venueCategories ?? []),
    item.address,
    item.category,
  ]);
}

function matchSpecialty(hay: string): SpecialtyMatch | null {
  if (MEXICAN_HIGH.test(hay) || MEXICAN_MEDIUM.test(hay)) {
    return { collection: "mexican", confidence: "high" };
  }
  if (ASIAN_HIGH.test(hay)) {
    return { collection: "asian", confidence: "high" };
  }
  if (PIZZA_HIGH.test(hay)) {
    return { collection: "pizza", confidence: "high" };
  }
  if (COFFEE_HIGH.test(hay)) {
    return { collection: "coffee_cafes", confidence: "high" };
  }
  if (BREWERY_WINE_HIGH.test(hay)) {
    return { collection: "breweries_wine", confidence: "high" };
  }
  if (DESSERT_BAKERY_HIGH.test(hay)) {
    return { collection: "desserts_bakeries", confidence: "high" };
  }
  return null;
}

/**
 * Assign exactly one editorial collection. When specialty confidence is not
 * high, fall back to Restaurants — never force a narrow bucket.
 */
export function inferFoodDrinkCollection(
  item: RankedDiscoveryItem["item"]
): FoodDrinkCollectionId {
  const hay = itemHay(item);
  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
  });

  const fromText = matchSpecialty(hay);
  if (fromText?.confidence === "high") {
    return fromText.collection;
  }

  if (venue.confidence !== "low") {
    if (venue.categoryId === "coffee_shop") return "coffee_cafes";
    if (venue.categoryId === "bakery") return "desserts_bakeries";
    if (venue.categoryId === "brewery" || venue.categoryId === "winery") {
      return "breweries_wine";
    }
  }

  const category = item.category as DiscoveryCategory;
  if (category === "coffee") return "coffee_cafes";
  if (category === "bakeries") return "desserts_bakeries";

  return "restaurants";
}

export function foodDrinkCollectionLabel(
  item: RankedDiscoveryItem["item"]
): string {
  return FOOD_DRINK_COLLECTION_LABEL[inferFoodDrinkCollection(item)];
}

export function summarizeFoodDrinkCollectionCounts(
  items: readonly RankedDiscoveryItem[]
): Record<FoodDrinkCollectionId, number> {
  const counts: Record<FoodDrinkCollectionId, number> = {
    restaurants: 0,
    mexican: 0,
    asian: 0,
    pizza: 0,
    coffee_cafes: 0,
    breweries_wine: 0,
    desserts_bakeries: 0,
  };
  for (const item of items) {
    counts[inferFoodDrinkCollection(item.item)] += 1;
  }
  return counts;
}

/** Items reassigned to Restaurants versus legacy specialty fingerprint rules. */
export function countRestaurantsFallbackFromLegacySpecialty(
  items: readonly RankedDiscoveryItem[],
  legacySpecialty: (item: RankedDiscoveryItem["item"]) => boolean
): number {
  let moved = 0;
  for (const item of items) {
    if (
      legacySpecialty(item.item) &&
      inferFoodDrinkCollection(item.item) === "restaurants"
    ) {
      moved += 1;
    }
  }
  return moved;
}
