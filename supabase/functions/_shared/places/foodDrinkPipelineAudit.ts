/**
 * Food & Drink pipeline observability — edition generation only.
 * Logs discovered → qualifying → published counts for the dining guide.
 */

import { allocateDiscoverySections } from "../discovery/sectionAllocation.ts";
import { localPlacesAsDiscoveryItems } from "../discovery/catalog.ts";
import { scoreDiscoveryItem } from "../discovery/score.ts";
import { passesLocalDiscoveryRadius } from "../discovery/localDiscoveryScope.ts";
import {
  DISCOVERY_PUBLISH_MIN_SCORE,
  meetsDiscoveryPublishThreshold,
} from "../editorial/publishing.ts";
import { shouldPublishEditorialConfidence } from "../editorial/confidence.ts";
import { RECOMMENDATION_PLACES_CATEGORIES } from "./index.ts";
import type { NormalizedPlace } from "./types.ts";
import type { DiscoveryPayload, RankedDiscoveryItem } from "../discovery/types.ts";

export type FoodDrinkPipelineAudit = {
  discovered: number;
  qualifying: number;
  published: number;
  filteredOut: number;
  byProviderCategory: Record<string, number>;
};

const FOOD_PROVIDER_CATEGORIES = new Set(RECOMMENDATION_PLACES_CATEGORIES);

function dedupeFoodPlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const byId = new Map<string, NormalizedPlace>();
  for (const place of places) {
    if (!FOOD_PROVIDER_CATEGORIES.has(place.category)) continue;
    if (!byId.has(place.providerId)) byId.set(place.providerId, place);
  }
  return Array.from(byId.values());
}

function meetsFoodPublishGates(
  item: RankedDiscoveryItem,
  ctx: {
    readerLat: number;
    readerLon: number;
    editionDate: string;
    city: string;
    region: string;
    state: string;
  }
): boolean {
  if (!meetsDiscoveryPublishThreshold(item.score)) return false;
  if (
    !passesLocalDiscoveryRadius(item, {
      readerLat: ctx.readerLat,
      readerLon: ctx.readerLon,
    })
  ) {
    return false;
  }
  const stored = item.item.editorialConfidence;
  if (stored && !shouldPublishEditorialConfidence(stored)) return false;
  return true;
}

export function auditFoodDrinkPipeline(input: {
  localPlaces: NormalizedPlace[];
  discovery: DiscoveryPayload;
  readerLat: number;
  readerLon: number;
}): FoodDrinkPipelineAudit {
  const foodPlaces = dedupeFoodPlaces(input.localPlaces);
  const byProviderCategory: Record<string, number> = {};
  for (const place of foodPlaces) {
    byProviderCategory[place.category] = (byProviderCategory[place.category] ?? 0) + 1;
  }

  const ctx = {
    editionDate: input.discovery.editionDate,
    city: input.discovery.location.city,
    region: input.discovery.location.region ?? "",
    state: input.discovery.location.state ?? "",
    readerLat: input.readerLat,
    readerLon: input.readerLon,
  };

  const ranked = localPlacesAsDiscoveryItems(foodPlaces).map((item) =>
    scoreDiscoveryItem(item, ctx)
  );

  const qualifying = ranked.filter((row) => meetsFoodPublishGates(row, ctx));

  const allocation = allocateDiscoverySections(input.discovery);

  return {
    discovered: foodPlaces.length,
    qualifying: qualifying.length,
    published: allocation.recommendations.length,
    filteredOut: Math.max(0, foodPlaces.length - qualifying.length),
    byProviderCategory,
  };
}

export function logFoodDrinkPipelineAudit(
  audit: FoodDrinkPipelineAudit,
  city: string
): void {
  console.log("[foodDrink:pipeline]", {
    city,
    discovered: audit.discovered,
    qualifying: audit.qualifying,
    filteredOut: audit.filteredOut,
    published: audit.published,
    minScore: DISCOVERY_PUBLISH_MIN_SCORE,
    byProviderCategory: audit.byProviderCategory,
  });
}
