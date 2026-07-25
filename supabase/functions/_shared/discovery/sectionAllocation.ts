/**
 * Server mirror of lib/edition/sectionAllocator.ts — must stay aligned with
 * the client allocator used by isPersistedEditionComplete().
 */

import type {
  DiscoveryCategory,
  DiscoveryPayload,
  DiscoveryRankingContext,
  DiscoverySurface,
  RankedDiscoveryItem,
} from "./types.ts";
import { discoveryItemsForSurface } from "./discoveryPayload.ts";
import { DISCOVERY_PUBLISH_MIN_SCORE } from "../editorial/publishing.ts";
import { shouldPublishEditorialConfidence } from "../editorial/confidence.ts";
import {
  isActivityProShopParts,
  isParticipatoryActivityVenue,
  venueHayFromParts,
} from "../editorial/venueQuality.ts";
import {
  passesActivitiesSectionRadius,
  passesLocalDiscoveryRadius,
  DESTINATION_ACTIVITY_CATEGORIES,
  RECOMMENDATION_CATEGORIES,
} from "./localDiscoveryScope.ts";
import { isFoodEstablishmentItem } from "./foodDrinkDesk.ts";
import { isServiceBusinessListing } from "../editorial/serviceBusinessFilter.ts";

const ALL_SURFACES: DiscoverySurface[] = [
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

const ACTIVITIES_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "hiking",
  "activities",
  ...DESTINATION_ACTIVITY_CATEGORIES,
]);

const NOTEBOOK_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "experiences",
  "books",
  "movies",
  "podcasts",
  "recipes",
]);

/** Mirror client meetsDiscoveryPublishConfidence — missing stored score passes. */
function meetsDiscoveryPublishConfidence(
  item: RankedDiscoveryItem["item"]
): boolean {
  const stored = item.editorialConfidence;
  if (!stored) return true;
  return shouldPublishEditorialConfidence(stored);
}

function belongsInActivities(item: RankedDiscoveryItem): boolean {
  if (isFoodEstablishmentItem(item)) return false;

  // Activities are experiences, never everyday service/professional businesses.
  if (
    isServiceBusinessListing({
      name: item.item.title,
      venueCategories: item.item.venueCategories,
      category: item.item.category,
      dek: item.item.dek,
    })
  ) {
    return false;
  }

  if (DESTINATION_ACTIVITY_CATEGORIES.has(item.item.category)) {
    return true;
  }

  if (item.item.category === "hiking") return true;

  if (item.item.category === "activities") {
    if (
      isActivityProShopParts([
        item.item.title,
        item.item.dek,
        ...(item.item.venueCategories ?? []),
      ])
    ) {
      return false;
    }
    const hay = venueHayFromParts([
      item.item.title,
      item.item.dek,
      ...(item.item.venueCategories ?? []),
    ]);
    return isParticipatoryActivityVenue(hay);
  }

  return false;
}

function isRealEvent(item: RankedDiscoveryItem): boolean {
  return Boolean(item.item.tags?.includes("local_event"));
}

function dedupeById(items: RankedDiscoveryItem[]): RankedDiscoveryItem[] {
  const seen = new Set<string>();
  const out: RankedDiscoveryItem[] = [];
  for (const item of items) {
    if (seen.has(item.item.id)) continue;
    seen.add(item.item.id);
    out.push(item);
  }
  return out;
}

function fullCandidatePool(
  discovery: DiscoveryPayload | null | undefined
): RankedDiscoveryItem[] {
  const byId = new Map<string, RankedDiscoveryItem>();
  for (const surface of ALL_SURFACES) {
    for (const ranked of discoveryItemsForSurface(discovery, surface)) {
      if (!byId.has(ranked.item.id)) byId.set(ranked.item.id, ranked);
    }
  }
  return [...byId.values()];
}

function readerContextFromDiscovery(
  discovery: DiscoveryPayload | null | undefined
): Pick<DiscoveryRankingContext, "readerLat" | "readerLon"> {
  return {
    readerLat: discovery?.location?.lat ?? null,
    readerLon: discovery?.location?.lon ?? null,
  };
}

export type SectionAllocation = {
  activities: RankedDiscoveryItem[];
  notebook: RankedDiscoveryItem[];
  recommendations: RankedDiscoveryItem[];
};

/** Partition discovery for homepage desks — mirrors client sectionAllocator. */
export function allocateDiscoverySections(
  discovery: DiscoveryPayload | null | undefined
): SectionAllocation {
  const minScore = DISCOVERY_PUBLISH_MIN_SCORE;
  const readerCtx = readerContextFromDiscovery(discovery);
  const pool = dedupeById(fullCandidatePool(discovery))
    .filter((d) => !isRealEvent(d))
    .filter((d) => Boolean(d.item.title?.trim()))
    .filter((d) => d.score >= minScore)
    .filter((d) => meetsDiscoveryPublishConfidence(d.item))
    .sort((a, b) => b.score - a.score);
  const claimed = new Set<string>();

  function claim(
    predicate: (item: RankedDiscoveryItem) => boolean
  ): RankedDiscoveryItem[] {
    const picked: RankedDiscoveryItem[] = [];
    for (const item of pool) {
      if (item.score < minScore) continue;
      if (claimed.has(item.item.id)) continue;
      if (!predicate(item)) continue;
      picked.push(item);
      claimed.add(item.item.id);
    }
    return picked;
  }

  const activities = claim(
    (item) =>
      belongsInActivities(item) &&
      passesActivitiesSectionRadius(item, readerCtx)
  );

  const notebook = claim((item) => NOTEBOOK_CATEGORIES.has(item.item.category));

  const recommendations = claim(
    (item) =>
      RECOMMENDATION_CATEGORIES.has(item.item.category) &&
      passesLocalDiscoveryRadius(item, readerCtx)
  );

  return { activities, notebook, recommendations };
}
