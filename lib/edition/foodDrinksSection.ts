/**
 * Food & Drinks homepage desk — resolve persisted edition_sections rows.
 * Canonical key: food_drinks (legacy recommendations normalizes here).
 */

import { isFoodDrinksEnabled } from "./editionSectionFlags.ts";

import type { EditionSection } from "./types.ts";
import type {
  DiscoveryCategory,
  DiscoveryPayload,
  DiscoverySurface,
  RankedDiscoveryItem,
} from "./discovery.ts";
import {
  isFoodDrinksSectionType,
} from "./editionSectionOwnership.ts";

export const FOOD_DRINKS_SECTION_TYPE = "food_drinks";

/** Mirrors `FOOD_DRINK_CATEGORIES` in foodDrinkDesk.ts — keep in sync. */
const FOOD_DRINK_CATEGORY_SET = new Set<DiscoveryCategory>([
  "restaurants",
  "coffee",
  "bakeries",
]);

export type PersistedFoodDrinksItem = {
  id: string;
  title?: string;
  category?: string;
  score?: number;
};

export type PersistedFoodDrinksBody = {
  version?: number;
  items?: PersistedFoodDrinksItem[];
};

const DISCOVERY_SURFACES: DiscoverySurface[] = [
  "bandits_picks",
  "weekend_ideas",
  "hidden_gems",
  "coffee",
  "restaurants",
  "beaches",
  "hiking",
  "museums",
  "parks",
  "scenic_drives",
  "books",
  "movies",
  "podcasts",
  "recipes",
  "activities",
  "bakeries",
  "gardens",
];

export function findFoodDrinksSection(
  sections: readonly EditionSection[]
): EditionSection | null {
  const canonical = sections.find((s) => s.section_type === FOOD_DRINKS_SECTION_TYPE);
  if (canonical) return canonical;
  return sections.find((s) => s.section_type === "recommendations") ?? null;
}

export function parseFoodDrinksSectionBody(
  body: string | null | undefined
): PersistedFoodDrinksBody | null {
  if (!body?.trim()) return null;
  try {
    const parsed = JSON.parse(body) as PersistedFoodDrinksBody;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFoodCategory(category: string | undefined): category is DiscoveryCategory {
  return FOOD_DRINK_CATEGORY_SET.has(category as DiscoveryCategory);
}

function surfaceForCategory(category: DiscoveryCategory): DiscoverySurface {
  if (category === "coffee") return "coffee";
  if (category === "bakeries") return "bakeries";
  return "restaurants";
}

export function indexDiscoveryItems(
  discovery: DiscoveryPayload | null | undefined
): Map<string, RankedDiscoveryItem> {
  const byId = new Map<string, RankedDiscoveryItem>();
  if (!discovery?.surfaces) return byId;
  for (const surface of DISCOVERY_SURFACES) {
    const items = discovery.surfaces[surface]?.items ?? [];
    for (const ranked of items) {
      const id = ranked?.item?.id;
      if (!id || byId.has(id)) continue;
      if (!ranked.item.title?.trim()) continue;
      byId.set(id, ranked);
    }
  }
  return byId;
}

function rankedFromPersistedStub(
  stub: PersistedFoodDrinksItem
): RankedDiscoveryItem | null {
  const title = stub.title?.trim();
  if (!title) return null;
  const category = isFoodCategory(stub.category) ? stub.category : "restaurants";
  return {
    item: {
      id: stub.id,
      title,
      dek: "",
      category,
      family: "food_drink",
      source: { name: "Kindred", tier: "local" },
      tags: ["local_place"],
    },
    score: typeof stub.score === "number" ? stub.score : 0,
    reasons: [],
    surfaces: [surfaceForCategory(category)],
  };
}

export function resolveFoodDrinksItemsFromSection(
  section: EditionSection | null | undefined,
  discovery: DiscoveryPayload | null | undefined
): RankedDiscoveryItem[] {
  if (!section || !isFoodDrinksSectionType(section.section_type)) return [];

  const parsed = parseFoodDrinksSectionBody(section.body);
  if (!parsed?.items?.length) return [];

  const index = indexDiscoveryItems(discovery);
  const resolved: RankedDiscoveryItem[] = [];
  const seen = new Set<string>();

  for (const stub of parsed.items) {
    if (!stub?.id || seen.has(stub.id)) continue;
    const fromDiscovery = index.get(stub.id);
    const ranked = fromDiscovery ?? rankedFromPersistedStub(stub);
    if (!ranked?.item.title?.trim()) continue;
    if (!isFoodCategory(ranked.item.category)) continue;
    seen.add(stub.id);
    resolved.push(ranked);
  }

  return resolved;
}

export function resolveFoodDrinksHomepageItemsUncached(input: {
  sections: readonly EditionSection[];
  discovery: DiscoveryPayload | null | undefined;
  fallbackItems?: RankedDiscoveryItem[] | null;
}): RankedDiscoveryItem[] {
  const section = findFoodDrinksSection(input.sections);
  const fromSection = resolveFoodDrinksItemsFromSection(section, input.discovery);
  if (fromSection.length > 0) return fromSection;
  return input.fallbackItems ?? [];
}

export function resolveFoodDrinksHomepageItems(input: {
  sections: readonly EditionSection[];
  discovery: DiscoveryPayload | null | undefined;
  fallbackItems?: RankedDiscoveryItem[] | null;
}): RankedDiscoveryItem[] {
  if (!isFoodDrinksEnabled()) return [];
  return resolveFoodDrinksHomepageItemsUncached(input);
}

/** Section types rendered by RecommendationsSection — hide from generic folio cards. */
export function isRenderedFoodDrinksSectionType(sectionType: string): boolean {
  return isFoodDrinksSectionType(sectionType);
}
