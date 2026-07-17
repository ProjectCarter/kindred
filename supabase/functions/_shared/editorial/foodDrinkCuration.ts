/**
 * Server mirror — lib/edition/foodDrinkCuration.ts
 */

import type { RankedDiscoveryItem } from "../discovery/types.ts";
import { resolveVenueClassification } from "../venueClassification.ts";
import { venueHayFromParts } from "./venueQuality.ts";

export type FoodEditorFingerprint =
  | "coffee_shop"
  | "bakery"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "pizza"
  | "mexican"
  | "sushi"
  | "asian"
  | "steakhouse"
  | "burgers"
  | "bbq"
  | "healthy_cafe"
  | "mediterranean"
  | "italian"
  | "vegetarian"
  | "brewery"
  | "wine_bar"
  | "cocktail_bar"
  | "ice_cream"
  | "donuts"
  | "dessert_shop"
  | "food_truck"
  | "general_restaurant";

export const FOOD_EDITOR_SPREAD_ORDER: FoodEditorFingerprint[] = [
  "coffee_shop",
  "bakery",
  "breakfast",
  "lunch",
  "dinner",
  "pizza",
  "mexican",
  "sushi",
  "asian",
  "burgers",
  "bbq",
  "steakhouse",
  "mediterranean",
  "italian",
  "vegetarian",
  "healthy_cafe",
  "brewery",
  "wine_bar",
  "cocktail_bar",
  "ice_cream",
  "donuts",
  "dessert_shop",
  "food_truck",
  "general_restaurant",
];

const KNOWN_FOOD_CHAINS: readonly string[] = [
  "starbucks",
  "dunkin",
  "chipotle",
  "panera",
  "mcdonald",
];

const FINGERPRINT_RULES: Array<{ fp: FoodEditorFingerprint; pattern: RegExp }> = [
  { fp: "food_truck", pattern: /\bfood truck|taco truck\b/i },
  { fp: "donuts", pattern: /\bdonut|doughnut\b/i },
  { fp: "ice_cream", pattern: /\bice cream|gelato\b/i },
  { fp: "dessert_shop", pattern: /\bdessert shop|cupcake shop\b/i },
  { fp: "coffee_shop", pattern: /\bcoffee shop|coffee house|espresso bar\b/i },
  { fp: "bakery", pattern: /\bbakery|bake shop|patisserie\b/i },
  { fp: "brewery", pattern: /\bbrewery|brewpub|taproom\b/i },
  { fp: "wine_bar", pattern: /\bwine bar|winery|vineyard\b/i },
  { fp: "cocktail_bar", pattern: /\bcocktail bar|speakeasy\b/i },
  { fp: "breakfast", pattern: /\bbreakfast|brunch|pancake|waffle house\b/i },
  { fp: "lunch", pattern: /\blunch|deli|sandwich shop\b/i },
  { fp: "pizza", pattern: /\bpizza|pizzeria\b/i },
  { fp: "mexican", pattern: /\bmexican|taco|taqueria|cantina\b/i },
  { fp: "sushi", pattern: /\bsushi|sashimi\b/i },
  { fp: "asian", pattern: /\bthai|vietnamese|chinese|korean|ramen|pho\b/i },
  { fp: "steakhouse", pattern: /\bsteakhouse|steak house|chophouse\b/i },
  { fp: "burgers", pattern: /\bburger|burger joint\b/i },
  { fp: "bbq", pattern: /\bbbq|barbecue|smokehouse\b/i },
  { fp: "healthy_cafe", pattern: /\bhealthy cafe|juice bar|smoothie\b/i },
  { fp: "italian", pattern: /\bitalian|trattoria|osteria|pasta house\b/i },
  { fp: "vegetarian", pattern: /\bvegetarian|vegan restaurant|plant[- ]based\b/i },
  { fp: "mediterranean", pattern: /\bmediterranean|greek|falafel|shawarma\b/i },
];

function itemHay(item: RankedDiscoveryItem["item"]): string {
  return venueHayFromParts([
    item.title,
    item.dek,
    ...(item.venueCategories ?? []),
    item.address,
    item.category,
  ]);
}

export function inferFoodEditorFingerprint(
  item: RankedDiscoveryItem["item"]
): FoodEditorFingerprint {
  const hay = itemHay(item);
  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
  });

  if (venue.categoryId === "coffee_shop") return "coffee_shop";
  if (venue.categoryId === "bakery") return "bakery";
  if (venue.categoryId === "brewery") return "brewery";
  if (venue.categoryId === "winery") return "wine_bar";
  if (venue.categoryId === "cocktail_bar") return "cocktail_bar";

  for (const { fp, pattern } of FINGERPRINT_RULES) {
    if (pattern.test(hay)) return fp;
  }

  if (item.category === "coffee") return "coffee_shop";
  if (item.category === "bakeries") return "bakery";
  if (item.category === "restaurants") return "dinner";
  return "general_restaurant";
}

export function resolveFoodChainKey(item: RankedDiscoveryItem["item"]): string | null {
  if (!item.tags?.includes("chain")) return null;
  const hay = item.title.toLowerCase();
  for (const chain of KNOWN_FOOD_CHAINS) {
    if (hay.includes(chain)) return chain;
  }
  return null;
}

export function curateFoodDrinkEdition(
  items: readonly RankedDiscoveryItem[],
  options?: {
    depth?: number;
    getScore?: (item: RankedDiscoveryItem) => number;
    maxPerFingerprint?: number;
    repeatScoreGap?: number;
  }
): RankedDiscoveryItem[] {
  if (items.length <= 1) return [...items];

  const getScore = options?.getScore ?? ((item) => item.score);
  const maxPerFingerprint = options?.maxPerFingerprint ?? 1;
  const repeatScoreGap = options?.repeatScoreGap ?? 10;
  const depth = options?.depth;

  const sorted = [...items].sort((a, b) => getScore(b) - getScore(a));
  const seenChains = new Set<string>();
  const pool: RankedDiscoveryItem[] = [];
  for (const item of sorted) {
    const chainKey = resolveFoodChainKey(item.item);
    if (chainKey) {
      if (seenChains.has(chainKey)) continue;
      seenChains.add(chainKey);
    }
    pool.push(item);
  }

  const fingerprintCounts = new Map<FoodEditorFingerprint, number>();
  const curated: RankedDiscoveryItem[] = [];
  const usedIds = new Set<string>();

  const tryPick = (item: RankedDiscoveryItem): boolean => {
    if (usedIds.has(item.item.id)) return false;
    const fp = inferFoodEditorFingerprint(item.item);
    const count = fingerprintCounts.get(fp) ?? 0;
    if (count >= maxPerFingerprint) return false;
    curated.push(item);
    usedIds.add(item.item.id);
    fingerprintCounts.set(fp, count + 1);
    return true;
  };

  for (const fp of FOOD_EDITOR_SPREAD_ORDER) {
    const candidates = pool
      .filter((item) => !usedIds.has(item.item.id))
      .filter((item) => inferFoodEditorFingerprint(item.item) === fp)
      .sort((a, b) => getScore(b) - getScore(a));
    if (candidates[0]) tryPick(candidates[0]);
    if (depth != null && curated.length >= depth) break;
  }

  const targetLen = depth ?? pool.length;
  while (curated.length < targetLen) {
    const remaining = pool.filter((item) => !usedIds.has(item.item.id));
    if (!remaining.length) break;
    const topScore = getScore(remaining[0]!);
    const band = remaining.filter((item) => getScore(item) >= topScore - 4);
    const pick = band.sort((a, b) => {
      const fpA = inferFoodEditorFingerprint(a.item);
      const fpB = inferFoodEditorFingerprint(b.item);
      const countA = fingerprintCounts.get(fpA) ?? 0;
      const countB = fingerprintCounts.get(fpB) ?? 0;
      if (countA !== countB) return countA - countB;
      return getScore(b) - getScore(a);
    })[0]!;
    const fp = inferFoodEditorFingerprint(pick.item);
    if ((fingerprintCounts.get(fp) ?? 0) >= maxPerFingerprint) {
      if (getScore(pick) < topScore - repeatScoreGap) break;
    }
    if (!tryPick(pick)) break;
  }

  if (depth != null) {
    return curated.slice(0, depth);
  }

  const tail = pool.filter((item) => !usedIds.has(item.item.id));
  return [...curated, ...tail];
}
