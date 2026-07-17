/**
 * Food & Drink desk curation — newspaper food editor variety, not top-N ranking.
 */

import type { RankedDiscoveryItem } from "./discovery";
import { resolveVenueClassification } from "./venueClassification";
import { venueHayFromParts } from "./venueQuality";
import { foodDrinkSortScore } from "./foodDrinkDesk";

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

export const FOOD_EDITOR_FINGERPRINT_LABEL: Record<FoodEditorFingerprint, string> = {
  coffee_shop: "Coffee Shop",
  bakery: "Bakery",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  pizza: "Pizza",
  mexican: "Mexican",
  sushi: "Sushi",
  asian: "Asian",
  steakhouse: "Steakhouse",
  burgers: "Burgers",
  bbq: "BBQ",
  healthy_cafe: "Healthy Café",
  mediterranean: "Mediterranean",
  italian: "Italian",
  vegetarian: "Vegetarian",
  brewery: "Brewery",
  wine_bar: "Wine Bar",
  cocktail_bar: "Cocktail Bar",
  ice_cream: "Ice Cream",
  donuts: "Donuts",
  dessert_shop: "Dessert Shop",
  food_truck: "Food Truck",
  general_restaurant: "Restaurant",
};

/** Spread order — aim for a balanced daily mix when quality allows. */
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
  "peet's coffee",
  "caribou coffee",
  "dutch bros",
  "tim hortons",
  "panera",
  "mcdonald",
  "burger king",
  "wendy",
  "taco bell",
  "chipotle",
  "subway",
  "chili",
  "applebee",
  "olive garden",
  "denny",
  "ihop",
  "domino",
  "pizza hut",
  "papa john",
  "little caesar",
  "kfc",
  "popeyes",
  "chick-fil-a",
  "chick fil a",
  "five guys",
  "shake shack",
  "in-n-out",
  "panda express",
  "dairy queen",
  "baskin-robbins",
  "baskin robbins",
  "cold stone",
  "krispy kreme",
  "cinnabon",
];

const FINGERPRINT_RULES: Array<{ fp: FoodEditorFingerprint; pattern: RegExp }> = [
  { fp: "food_truck", pattern: /\bfood truck|taco truck|mobile kitchen\b/i },
  { fp: "donuts", pattern: /\bdonut|doughnut\b/i },
  { fp: "ice_cream", pattern: /\bice cream|gelato|frozen yogurt|froyo\b/i },
  { fp: "dessert_shop", pattern: /\bdessert shop|cupcake shop|cake shop|sweet shop\b/i },
  { fp: "coffee_shop", pattern: /\bcoffee shop|coffee house|espresso bar|coffee roaster\b/i },
  { fp: "bakery", pattern: /\bbakery|bake shop|patisserie\b/i },
  { fp: "brewery", pattern: /\bbrewery|brewpub|taproom|craft beer\b/i },
  { fp: "wine_bar", pattern: /\bwine bar|winery|vineyard\b/i },
  { fp: "cocktail_bar", pattern: /\bcocktail bar|speakeasy|mixology\b/i },
  { fp: "breakfast", pattern: /\bbreakfast|brunch|pancake|waffle house|bagel shop\b/i },
  { fp: "lunch", pattern: /\blunch|deli|sandwich shop|soup and salad\b/i },
  { fp: "pizza", pattern: /\bpizza|pizzeria\b/i },
  { fp: "mexican", pattern: /\bmexican|taco|taqueria|cantina|burrito\b/i },
  { fp: "sushi", pattern: /\bsushi|sashimi|japanese restaurant\b/i },
  { fp: "asian", pattern: /\bthai|vietnamese|chinese|korean|ramen|pho|noodle house|dim sum\b/i },
  { fp: "steakhouse", pattern: /\bsteakhouse|steak house|chophouse\b/i },
  { fp: "burgers", pattern: /\bburger|burger joint\b/i },
  { fp: "bbq", pattern: /\bbbq|barbecue|barbeque|smokehouse\b/i },
  { fp: "healthy_cafe", pattern: /\bhealthy cafe|juice bar|smoothie bowl|acai\b/i },
  { fp: "italian", pattern: /\bitalian|trattoria|osteria|pasta house|risotto\b/i },
  { fp: "vegetarian", pattern: /\bvegetarian|vegan restaurant|plant[- ]based\b/i },
  { fp: "mediterranean", pattern: /\bmediterranean|greek|falafel|shawarma|hummus\b/i },
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

export function foodEditorFingerprintLabel(
  item: RankedDiscoveryItem["item"]
): string {
  return FOOD_EDITOR_FINGERPRINT_LABEL[inferFoodEditorFingerprint(item)];
}

/** One chain identity per edition — avoids multiple Starbucks locations, etc. */
export function resolveFoodChainKey(item: RankedDiscoveryItem["item"]): string | null {
  if (!item.tags?.includes("chain")) return null;
  const hay = item.title.toLowerCase();
  for (const chain of KNOWN_FOOD_CHAINS) {
    if (hay.includes(chain)) return chain;
  }
  const normalized = hay
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
  return normalized || null;
}

export type FoodDrinkCurationOptions = {
  /** Homepage depth — full list when omitted. */
  depth?: number;
  getScore?: (item: RankedDiscoveryItem) => number;
  /** Max picks per food fingerprint before quality override. */
  maxPerFingerprint?: number;
  /** Score gap required to allow a second pick from the same fingerprint. */
  repeatScoreGap?: number;
};

const DEFAULT_REPEAT_SCORE_GAP = 10;

function allowsFingerprintRepeat(
  count: number,
  score: number,
  topScore: number,
  repeatScoreGap: number
): boolean {
  if (count < 1) return true;
  if (repeatScoreGap === Number.POSITIVE_INFINITY) return false;
  return score >= topScore - repeatScoreGap;
}

function compareByScore(
  a: RankedDiscoveryItem,
  b: RankedDiscoveryItem,
  getScore: (item: RankedDiscoveryItem) => number
): number {
  return getScore(b) - getScore(a);
}

/**
 * Curate like a newspaper food editor — variety first, quality always wins on
 * close calls, never force categories that aren't in the pool.
 */
export function curateFoodDrinkEdition(
  items: readonly RankedDiscoveryItem[],
  options?: FoodDrinkCurationOptions
): RankedDiscoveryItem[] {
  if (items.length <= 1) return [...items];

  const getScore = options?.getScore ?? foodDrinkSortScore;
  const maxPerFingerprint = options?.maxPerFingerprint ?? 1;
  const repeatScoreGap = options?.repeatScoreGap ?? DEFAULT_REPEAT_SCORE_GAP;
  const depth = options?.depth;

  const sorted = [...items].sort((a, b) => compareByScore(a, b, getScore));
  const pool = dedupeFoodChains(sorted, getScore);
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

  // Round 1 — one pick per fingerprint in editorial spread order.
  for (const fp of FOOD_EDITOR_SPREAD_ORDER) {
    const candidates = pool
      .filter((item) => !usedIds.has(item.item.id))
      .filter((item) => inferFoodEditorFingerprint(item.item) === fp)
      .sort((a, b) => compareByScore(a, b, getScore));
    if (candidates[0]) tryPick(candidates[0]);
    if (depth != null && curated.length >= depth) break;
  }

  // Round 2 — fill remaining slots; prefer unseen fingerprints, allow repeats
  // only when the pick is clearly stronger than alternatives.
  const targetLen = depth ?? pool.length;
  while (curated.length < targetLen) {
    const remaining = pool.filter((item) => !usedIds.has(item.item.id));
    if (!remaining.length) break;

    const topScore = getScore(remaining[0]!);
    const band = remaining.filter(
      (item) => getScore(item) >= topScore - 4
    );

    const pick = band.sort((a, b) => {
      const fpA = inferFoodEditorFingerprint(a.item);
      const fpB = inferFoodEditorFingerprint(b.item);
      const countA = fingerprintCounts.get(fpA) ?? 0;
      const countB = fingerprintCounts.get(fpB) ?? 0;

      if (countA !== countB) return countA - countB;

      const canRepeatA = allowsFingerprintRepeat(
        countA,
        getScore(a),
        topScore,
        repeatScoreGap
      );
      const canRepeatB = allowsFingerprintRepeat(
        countB,
        getScore(b),
        topScore,
        repeatScoreGap
      );
      if (canRepeatA !== canRepeatB) return canRepeatB ? 1 : -1;

      return compareByScore(a, b, getScore);
    })[0]!;

    const fp = inferFoodEditorFingerprint(pick.item);
    const count = fingerprintCounts.get(fp) ?? 0;
    if (count >= maxPerFingerprint) {
      const nextDifferent = remaining.find(
        (item) =>
          !usedIds.has(item.item.id) &&
          (fingerprintCounts.get(inferFoodEditorFingerprint(item.item)) ?? 0) <
            maxPerFingerprint
      );
      if (!nextDifferent) {
        if (!allowsFingerprintRepeat(count, getScore(pick), topScore, repeatScoreGap)) {
          break;
        }
        if (count >= maxPerFingerprint + 1) break;
      } else {
        tryPick(nextDifferent);
        continue;
      }
    }

    if (!tryPick(pick)) break;
  }

  if (depth != null) {
    return curated.slice(0, depth);
  }

  const tail = pool.filter((item) => !usedIds.has(item.item.id));
  return [...curated, ...tail];
}

function dedupeFoodChains(
  sorted: RankedDiscoveryItem[],
  getScore: (item: RankedDiscoveryItem) => number
): RankedDiscoveryItem[] {
  const seenChains = new Set<string>();
  const out: RankedDiscoveryItem[] = [];

  for (const item of sorted) {
    const chainKey = resolveFoodChainKey(item.item);
    if (chainKey) {
      if (seenChains.has(chainKey)) continue;
      seenChains.add(chainKey);
    }
    out.push(item);
  }

  return out.sort((a, b) => compareByScore(a, b, getScore));
}
