/**
 * Food & Drinks reader-facing presentation — editorial recommendations, not map listings.
 * Verified facts only: provider categories, editorial labels, city, and existing notes.
 */

import type { DiscoveryItem } from "./discovery.ts";
import { containsGenericAiPhrase } from "./editorialIntelligence";
import {
  VENUE_EDITORIAL_LABEL_DISPLAY,
  type VenueEditorialLabelId,
} from "./venueEditorialScore.ts";
import { extractCityState } from "./venueClassification.ts";

const STREET_ADDRESS_PATTERN =
  /\b\d+\s+[NSEW]?\s*[\w.'-]+\s+(?:rd|road|st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|loop|hwy|highway)\b/i;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/;
const ADDRESS_SEPARATOR_PATTERN = /\s+[—–-]\s+[A-Za-z .'-]+$/;

const FALLBACK_NOTE_PATTERN =
  /^a (coffee shop|restaurant|bakery) worth knowing about/i;
const GENERIC_NOTE_PATTERNS: RegExp[] = [
  /\bmust-?visit\b/i,
  /\bworth checking out\b/i,
  /\bperfect for all ages\b/i,
  /\bfun for the whole family\b/i,
  /\bdon't miss\b/i,
];

const KNOWN_FOOD_CHAINS: readonly string[] = [
  "starbucks",
  "dunkin",
  "peet's coffee",
  "panera",
  "mcdonald",
  "burger king",
  "wendy",
  "taco bell",
  "chipotle",
  "subway",
  "chili",
  "olive garden",
  "domino",
  "pizza hut",
  "papa john",
  "little caesar",
  "kfc",
  "chick-fil-a",
  "five guys",
  "in-n-out",
  "panda express",
  "mod pizza",
  "sprouts farmers market",
  "sprouts",
  "texas roadhouse",
  "grimaldi",
  "cheesecake factory",
  "red robin",
  "outback",
  "applebee",
];

const GENERIC_VENUE_CATEGORIES = new Set([
  "restaurant",
  "food",
  "establishment",
  "dining",
  "meal takeaway",
  "meal delivery",
  "food and drink shop",
]);

const LABEL_EDITORIAL_HOOK: Partial<Record<VenueEditorialLabelId, string>> = {
  editors_pick: "One of the desk's stronger picks",
  local_favorite: "A local favorite",
  hidden_gem: "An easy-to-overlook spot",
  worth_the_drive: "Worth the drive",
  worth_the_wait: "Worth planning around",
  neighborhood_institution: "A neighborhood institution",
  regional_specialty: "Known for a regional specialty",
  historic_favorite: "A longtime local standby",
  new_discovery: "A newer spot worth watching",
  best_breakfast: "A strong breakfast stop",
  best_brunch: "A reliable brunch pick",
  best_coffee: "A coffee stop worth the detour",
  best_bakery: "Fresh-baked goods worth seeking out",
  best_date_night: "A good date-night option",
  best_family_meal: "A solid family meal option",
  best_late_night: "A late-night option when others have closed",
  best_dessert: "A dessert stop worth saving room for",
  best_outdoor_dining: "Outdoor seating when the weather cooperates",
  best_patio: "A patio worth asking for",
  best_dog_friendly: "Dog-friendly when you're dining with a pup",
};

export function isAddressStyleFoodCopy(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return false;
  if (STREET_ADDRESS_PATTERN.test(trimmed)) return true;
  if (ZIP_PATTERN.test(trimmed)) return true;
  if (/^\d/.test(trimmed) && /,\s*[A-Z]{2}\b/.test(trimmed)) return true;
  if (ADDRESS_SEPARATOR_PATTERN.test(trimmed) && STREET_ADDRESS_PATTERN.test(trimmed)) {
    return true;
  }
  return false;
}

function isChainItem(item: DiscoveryItem): boolean {
  if (item.tags?.includes("chain")) return true;
  const hay = item.title.toLowerCase();
  return KNOWN_FOOD_CHAINS.some((chain) => hay.includes(chain));
}

function resolveCity(item: DiscoveryItem, fallbackCity?: string | null): string | null {
  return item.place?.city?.trim() || extractCityState(item.address).city || fallbackCity?.trim() || null;
}

function resolveState(item: DiscoveryItem): string | null {
  return item.place?.state?.trim() || extractCityState(item.address).state || null;
}

function normalizeExperiencePhrase(category: string, discoveryCategory: string): string {
  const lower = category.toLowerCase();

  if (lower.includes("hawaiian")) return "Hawaiian cooking";
  if (lower.includes("german")) return "German fare";
  if (lower.includes("english") || lower.includes("past")) {
    return "handheld pies and pub-style fare";
  }
  if (lower.includes("breakfast")) return "breakfast plates";
  if (lower.includes("brunch")) return "brunch";
  if (lower.includes("café") || lower.includes("cafe")) return "café fare";
  if (lower.includes("coffee")) return "coffee";
  if (lower.includes("bakery")) return "fresh-baked goods";
  if (lower.includes("donut") || lower.includes("doughnut")) return "donuts and baked treats";
  if (lower.includes("ice cream") || lower.includes("gelato")) return "frozen treats";
  if (lower.includes("dessert")) return "desserts";
  if (lower.includes("pizza") || lower.includes("pizzeria")) return "pizza";
  if (lower.includes("sushi") || lower.includes("japanese")) return "Japanese fare";
  if (lower.includes("ramen") || lower.includes("noodle")) return "noodle bowls";
  if (lower.includes("mexican") || lower.includes("taco") || lower.includes("cantina")) {
    return "Mexican cooking";
  }
  if (lower.includes("thai")) return "Thai cooking";
  if (lower.includes("chinese")) return "Chinese cooking";
  if (lower.includes("korean")) return "Korean cooking";
  if (lower.includes("vietnamese")) return "Vietnamese cooking";
  if (lower.includes("indian")) return "Indian cooking";
  if (lower.includes("mediterranean")) return "Mediterranean fare";
  if (lower.includes("italian")) return "Italian cooking";
  if (lower.includes("steak")) return "steakhouse dining";
  if (lower.includes("seafood")) return "seafood";
  if (lower.includes("bbq") || lower.includes("barbecue")) return "barbecue";
  if (lower.includes("burger")) return "burgers";
  if (lower.includes("brewery") || lower.includes("brewpub")) return "craft beer and pub food";
  if (lower.includes("beer garden")) return "beer-garden seating";
  if (lower.includes("winery") || lower.includes("wine bar")) return "wine-bar fare";
  if (lower.includes("cocktail")) return "cocktails";
  if (lower.includes("sports bar") || lower.includes("pub")) return "pub fare";
  if (lower.includes("farmers market") || lower.includes("grocery")) {
    return "fresh produce and grocery staples";
  }
  if (lower.includes("food truck")) return "food-truck fare";
  if (lower.includes("juice")) return "juice and light bites";
  if (lower.includes("vegetarian") || lower.includes("vegan")) return "plant-forward fare";

  if (discoveryCategory === "coffee") return "coffee";
  if (discoveryCategory === "bakeries") return "fresh-baked goods";

  const stripped = category
    .replace(/\s+restaurant$/i, "")
    .replace(/\s+spot$/i, "")
    .replace(/\s+shop$/i, "")
    .trim();
  return stripped || category.trim();
}

function experienceSummary(item: DiscoveryItem): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const raw of item.venueCategories ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (GENERIC_VENUE_CATEGORIES.has(trimmed.toLowerCase())) continue;
    const phrase = normalizeExperiencePhrase(trimmed, item.category);
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(phrase);
    if (parts.length >= 2) break;
  }

  if (parts.length >= 2) {
    return `${parts[0]} and ${parts[1]!.toLowerCase()}`;
  }
  if (parts.length === 1) return parts[0]!;

  if (item.category === "coffee") return "coffee";
  if (item.category === "bakeries") return "fresh-baked goods";
  return "local dining";
}

function templateIndex(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % count;
  }
  return hash;
}

function primaryEditorialHook(item: DiscoveryItem): string | null {
  for (const label of item.venueEditorial?.labels ?? []) {
    const hook = LABEL_EDITORIAL_HOOK[label as VenueEditorialLabelId];
    if (hook) return hook;
    const display = VENUE_EDITORIAL_LABEL_DISPLAY[label as VenueEditorialLabelId];
    if (display) return `A ${display.toLowerCase()} pick`;
  }
  return null;
}

function isUsableExistingNote(note: string, item: DiscoveryItem): boolean {
  const trimmed = note.trim();
  if (trimmed.length < 18) return false;
  if (trimmed === item.title.trim()) return false;
  if (isAddressStyleFoodCopy(trimmed)) return false;
  if (FALLBACK_NOTE_PATTERN.test(trimmed)) return false;
  if (GENERIC_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  if (containsGenericAiPhrase(trimmed)) return false;
  return true;
}

export function composeFoodDrinkEditorialNote(
  item: DiscoveryItem,
  fallbackCity?: string | null
): string {
  const city = resolveCity(item, fallbackCity);
  const experience = experienceSummary(item);
  const hook = primaryEditorialHook(item);
  const chain = isChainItem(item);
  const cityPhrase = city ? ` in ${city}` : "";
  const seed = item.id || item.title;

  if (hook && !chain) {
    return `${hook}${cityPhrase} for ${experience}.`;
  }

  if (chain) {
    return `A reliable ${experience} option${cityPhrase} when you want something familiar.`;
  }

  if (city) {
    const templates = [
      `${city} spot for ${experience}.`,
      `${experience} in ${city} — one to keep on your short list.`,
      `Head to ${city} when you're in the mood for ${experience}.`,
    ];
    return templates[templateIndex(seed, templates.length)]!;
  }

  if (experience) {
    return `Worth a stop for ${experience}.`;
  }

  return "A verified local place worth a closer look.";
}

export function foodDrinkEditorialNote(
  item: DiscoveryItem,
  fallbackCity?: string | null
): string | null {
  const dek = item.dek?.trim();
  if (dek && isUsableExistingNote(dek, item)) return dek;
  const composed = composeFoodDrinkEditorialNote(item, fallbackCity).trim();
  return composed || null;
}

export function foodDrinkLocationLine(
  item: DiscoveryItem,
  fallbackCity?: string | null
): string | null {
  const city = resolveCity(item, fallbackCity);
  const state = resolveState(item);
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (item.address?.trim()) return item.address.trim();
  return null;
}
