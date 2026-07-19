/**
 * Food & Drinks cuisine emoji — one specific glyph per restaurant.
 * Priority-ordered rules; generic 🍽️ only when nothing more specific matches.
 *
 * Canonical law: kindred-visual-language.mdc (Food & Drinks desk extension).
 */

import type { DiscoveryCategory } from "./discovery.ts";
import type { EditorialCategoryId } from "./editorialCategory.ts";
import { hayFromParts } from "./editorialEmojiCatalog.ts";

export const FOOD_DRINK_CUISINE_EMOJI = {
  pizza: "🍕",
  burgers: "🍔",
  tacos: "🌮",
  burritos: "🌯",
  hot_dogs: "🌭",
  sandwiches: "🥪",
  chicken: "🍗",
  steakhouse: "🥩",
  bbq: "🍖",
  italian: "🍝",
  indian: "🍛",
  mediterranean: "🥙",
  sushi: "🍣",
  ramen: "🍜",
  dumplings: "🥟",
  chinese: "🥡",
  japanese: "🍱",
  seafood: "🍤",
  lobster: "🦞",
  crab: "🦀",
  oyster_bar: "🦪",
  wine_bar: "🍷",
  cocktail_lounge: "🍸",
  brewery: "🍺",
  coffee: "☕",
  bakery: "🥐",
  pastries: "🧁",
  donuts: "🍩",
  dessert: "🍰",
  ice_cream: "🍦",
  pancakes: "🥞",
  breakfast: "🍳",
  salads: "🥗",
  vegetarian: "🌱",
  vegan: "🌿",
  fine_dining: "🍴",
  restaurant: "🍽️",
} as const;

type CuisineRule = { emoji: string; test: RegExp };

/** Most specific cuisine wins — order is editorial law for this desk. */
const FOOD_DRINK_CUISINE_RULES: readonly CuisineRule[] = [
  { emoji: FOOD_DRINK_CUISINE_EMOJI.pizza, test: /\b(pizza|pizzeria)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.burgers, test: /\b(burgers?|smash burger|burger joint|cheeseburger)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.tacos, test: /\b(taco|taqueria|taco shop|taco bar)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.burritos, test: /\b(burrito|burrito bar|burrito bowl)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.hot_dogs, test: /\b(hot dog|hotdog|frankfurter|wiener\b.*\bstand)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.sandwiches,
    test: /\b(sandwich|deli|sub shop|hoagie|panini|po'?boy|bagel shop)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.chicken,
    test: /\b(fried chicken|chicken wing|wings|rotisserie|chicken shack|chicken tender|chicken house)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.steakhouse,
    test: /\b(steakhouse|steak house|chophouse|prime rib)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.bbq, test: /\b(bbq|barbecue|barbeque|smokehouse|smoked meat)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.italian,
    test: /\b(italian|trattoria|osteria|pasta house|risotto|lasagna|ravioli)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.indian,
    test: /\b(indian|curry house|tandoori|masala|biryani|naan\b.*\bkitchen)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.mediterranean,
    test: /\b(mediterranean|greek|gyro|falafel|shawarma|hummus|souvlaki|mezze)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.sushi, test: /\b(sushi|sashimi|nigiri|omakase|maki roll)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.ramen, test: /\b(ramen|ramen shop|tonkotsu|shoyu ramen)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.dumplings, test: /\b(dumpling|dim sum|gyoza|potsticker|bao bun)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.chinese,
    test: /\b(chinese|szechuan|sichuan|cantonese|wok kitchen|chow mein|kung pao)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.japanese,
    test: /\b(japanese|izakaya|teppanyaki|teriyaki|yakitori|udon|bento)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.oyster_bar, test: /\b(oyster bar|raw bar|oyster house|oyster shuck)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.lobster, test: /\b(lobster|lobster roll|lobster shack)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.crab, test: /\b(crab house|crab shack|crab boil|soft shell crab)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.seafood,
    test: /\b(seafood|fish house|fish market|ceviche|shrimp boil)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.wine_bar, test: /\b(wine bar|winery|vineyard|wine tasting)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.cocktail_lounge,
    test: /\b(cocktail bar|cocktail lounge|speakeasy|mixology|martini bar)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.brewery, test: /\b(brewery|brewpub|taproom|craft beer)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.coffee,
    test: /\b(coffee shop|coffee house|espresso bar|coffee roaster|café|cafe\b)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.bakery, test: /\b(bakery|bake shop|patisserie|bread bakery)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.pastries,
    test: /\b(pastry shop|pastry cafe|croissant|macaron shop)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.donuts, test: /\b(donut|doughnut)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.dessert,
    test: /\b(dessert shop|cupcake shop|cake shop|sweet shop|chocolatier)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.ice_cream, test: /\b(ice cream|gelato|frozen yogurt|froyo)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.pancakes, test: /\b(pancake|waffle house|crepe)\b/i },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.breakfast, test: /\b(breakfast|brunch|morning cafe)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.salads,
    test: /\b(salad bar|salad shop|greens cafe|chopped salad)\b/i,
  },
  { emoji: FOOD_DRINK_CUISINE_EMOJI.vegan, test: /\b(vegan restaurant|vegan cafe|plant[- ]based kitchen)\b/i },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.vegetarian,
    test: /\b(vegetarian restaurant|vegetarian cafe|meatless kitchen)\b/i,
  },
  {
    emoji: FOOD_DRINK_CUISINE_EMOJI.fine_dining,
    test: /\b(fine dining|tasting menu|chef'?s table|michelin|upscale dining)\b/i,
  },
];

const FOOD_DRINK_CATEGORIES = new Set<DiscoveryCategory>([
  "restaurants",
  "coffee",
  "bakeries",
  "recipes",
]);

const FOOD_EDITORIAL_CATEGORY_IDS = new Set<EditorialCategoryId>([
  "restaurant",
  "coffee_shop",
  "bakery",
  "brewery",
  "winery",
  "cocktail_bar",
]);

const EDITORIAL_CATEGORY_EMOJI: Partial<Record<EditorialCategoryId, string>> = {
  coffee_shop: FOOD_DRINK_CUISINE_EMOJI.coffee,
  bakery: FOOD_DRINK_CUISINE_EMOJI.bakery,
  brewery: FOOD_DRINK_CUISINE_EMOJI.brewery,
  winery: FOOD_DRINK_CUISINE_EMOJI.wine_bar,
  cocktail_bar: FOOD_DRINK_CUISINE_EMOJI.cocktail_lounge,
};

export type FoodDrinkCuisineIconInput = {
  title: string;
  dek?: string | null;
  category?: DiscoveryCategory | string | null;
  venueCategories?: string[] | null;
  tags?: string[] | null;
  editorialCategoryId?: EditorialCategoryId | null;
};

export function isFoodDrinkDiscoveryItem(
  item: FoodDrinkCuisineIconInput,
  context?: "event" | "activity" | "recommendation" | "bandits_pick"
): boolean {
  if (context === "recommendation") return true;
  if (item.category && FOOD_DRINK_CATEGORIES.has(item.category as DiscoveryCategory)) {
    return true;
  }
  if (
    item.editorialCategoryId &&
    FOOD_EDITORIAL_CATEGORY_IDS.has(item.editorialCategoryId)
  ) {
    return true;
  }
  return false;
}

function cuisineHay(input: FoodDrinkCuisineIconInput): string {
  return hayFromParts([
    input.title,
    input.dek,
    ...(input.venueCategories ?? []),
    ...(input.tags ?? []),
    input.category,
  ]);
}

function emojiFromRules(hay: string): string | null {
  for (const rule of FOOD_DRINK_CUISINE_RULES) {
    if (rule.test.test(hay)) return rule.emoji;
  }
  return null;
}

function discoveryCategoryFallback(
  category: DiscoveryCategory | string | null | undefined
): string | null {
  if (category === "coffee") return FOOD_DRINK_CUISINE_EMOJI.coffee;
  if (category === "bakeries") return FOOD_DRINK_CUISINE_EMOJI.bakery;
  return null;
}

/**
 * Resolve one cuisine-specific emoji for a Food & Drinks listing.
 * Always returns a glyph for food-drink items.
 */
export function resolveFoodDrinkCuisineEmoji(
  input: FoodDrinkCuisineIconInput
): string {
  const hay = cuisineHay(input);

  const fromRules = emojiFromRules(hay);
  if (fromRules) return fromRules;

  if (
    input.editorialCategoryId &&
    EDITORIAL_CATEGORY_EMOJI[input.editorialCategoryId]
  ) {
    return EDITORIAL_CATEGORY_EMOJI[input.editorialCategoryId]!;
  }

  const fromCategory = discoveryCategoryFallback(input.category);
  if (fromCategory) return fromCategory;

  return FOOD_DRINK_CUISINE_EMOJI.restaurant;
}
