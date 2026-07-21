/**
 * Homepage Activities — newspaper-style spread from the verified metro pool.
 *
 * Picks the first N cards for the homepage grid. Does not change retrieval,
 * verification, or See All ordering beyond re-ranking the edition pool.
 */

import type { RankedDiscoveryItem } from "./discovery.ts";
import { inferActivitySubtype } from "./activitySubtype.ts";
import {
  compareByLocalProximity,
  isWithinActivitiesSectionRadius,
  type ReaderLocation,
} from "./localDiscoveryScope.ts";
import { isFoodEstablishmentItem } from "./foodDrinkDesk.ts";
import {
  isActivityProShopParts,
  isParticipatoryActivityVenue,
  isScenicOrHiddenGem,
  venueHayFromParts,
} from "./venueQuality.ts";
import {
  LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  selectEditorialSpread,
} from "./editorialDiversity.ts";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing.ts";

export const ACTIVITIES_HOMEPAGE_MAX_PER_SUBTYPE = 2;
export const ACTIVITIES_HOMEPAGE_MAX_BOWLING = 2;

export type ActivitiesHomepageDesk =
  | "hiking"
  | "museums"
  | "botanical_garden"
  | "park"
  | "scenic"
  | "beach"
  | "escape_rooms"
  | "water_recreation"
  | "rock_climbing"
  | "pickleball"
  | "bowling";

export type ActivitiesHomepageDeskTarget = {
  desk: ActivitiesHomepageDesk;
  ideal: number;
};

/** Ideal slots when strong verified picks exist — unfilled roll to Editor's Choice. */
export const ACTIVITIES_HOMEPAGE_DESK_TARGETS: ActivitiesHomepageDeskTarget[] = [
  { desk: "hiking", ideal: 1 },
  { desk: "museums", ideal: 1 },
  { desk: "botanical_garden", ideal: 1 },
  { desk: "park", ideal: 1 },
  { desk: "scenic", ideal: 1 },
  { desk: "beach", ideal: 1 },
  { desk: "escape_rooms", ideal: 1 },
  { desk: "water_recreation", ideal: 1 },
  { desk: "rock_climbing", ideal: 1 },
  { desk: "pickleball", ideal: 1 },
];

const DESK_TARGET_BOOST = 14;

const DESTINATION_CATEGORIES = new Set([
  "museums",
  "hiking",
  "gardens",
  "parks",
  "beaches",
  "scenic_drives",
]);

function activityHay(item: RankedDiscoveryItem["item"]): string {
  return venueHayFromParts([
    item.title,
    item.dek,
    ...(item.venueCategories ?? []),
  ]);
}

export function isActivityProShopItem(item: RankedDiscoveryItem): boolean {
  return isActivityProShopParts([
    item.item.title,
    item.item.dek,
    ...(item.item.venueCategories ?? []),
  ]);
}

function isCompleteActivityCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

/** Diversity bucket for homepage spread — destination category or activity subtype. */
export function classifyActivityDiversityCategory(item: RankedDiscoveryItem): string {
  switch (item.item.category) {
    case "museums":
      return "museums";
    case "hiking":
      return "hiking";
    case "gardens":
      return "botanical_garden";
    case "parks":
      return "park";
    case "beaches":
      return "beach";
    case "scenic_drives":
      return "scenic";
    default:
      return inferActivitySubtype(item.item);
  }
}

export function classifyActivityHomepageDesk(
  item: RankedDiscoveryItem
): ActivitiesHomepageDesk | null {
  const bucket = classifyActivityDiversityCategory(item);
  if (bucket === "hiking") return "hiking";
  if (bucket === "museums") return "museums";
  if (bucket === "botanical_garden") return "botanical_garden";
  if (bucket === "park") return "park";
  if (bucket === "scenic") return "scenic";
  if (bucket === "beach") return "beach";
  if (bucket === "escape_rooms") return "escape_rooms";
  if (bucket === "water_recreation") return "water_recreation";
  if (bucket === "rock_climbing") return "rock_climbing";
  if (bucket === "pickleball") return "pickleball";
  if (bucket === "bowling") return "bowling";
  return null;
}

export function scoreActivityForHomepageSelection(
  item: RankedDiscoveryItem,
  readerLocation?: ReaderLocation | null
): number {
  let score = item.score ?? 0;
  const category = item.item.category;
  const hay = activityHay(item.item);

  if (DESTINATION_CATEGORIES.has(category)) score += 10;
  if (category === "hiking") score += 4;
  if (category === "museums") score += 6;
  if (category === "gardens") score += 6;
  if (isScenicOrHiddenGem(hay)) score += 5;
  if (/\bmural|sculpture|public art|art walk\b/i.test(hay)) score += 4;
  if (item.item.tags?.includes("chain")) score -= 6;
  if (category === "activities" && !isParticipatoryActivityVenue(hay)) score -= 20;
  if (isParticipatoryActivityVenue(hay)) score += 4;

  return score;
}

export function filterEligibleActivitiesForDesk(
  items: readonly RankedDiscoveryItem[],
  readerLocation?: ReaderLocation | null
): RankedDiscoveryItem[] {
  return items.filter(
    (item) =>
      !isFoodEstablishmentItem(item) &&
      isCompleteActivityCard(item.item) &&
      !isActivityProShopItem(item) &&
      isWithinActivitiesSectionRadius(item, readerLocation)
  );
}

function sortByHomepageRank(
  items: RankedDiscoveryItem[],
  readerLocation?: ReaderLocation | null
): RankedDiscoveryItem[] {
  return [...items].sort((a, b) => {
    const proximity = compareByLocalProximity(a, b, readerLocation ?? null);
    if (proximity !== 0) return proximity;
    return (
      scoreActivityForHomepageSelection(b, readerLocation) -
      scoreActivityForHomepageSelection(a, readerLocation)
    );
  });
}

function activitySelectionKey(item: RankedDiscoveryItem): string {
  return item.item.id;
}

function activityVenueKey(item: RankedDiscoveryItem): string | null {
  return item.item.title?.trim() || null;
}

function activityGeographyKey(item: RankedDiscoveryItem): string | null {
  return item.item.place?.city?.trim() || item.item.address?.trim() || null;
}

export function isActivitySubtypeEligibleForHomepage(
  item: RankedDiscoveryItem,
  categoryCounts: ReadonlyMap<string, number>
): boolean {
  const key = classifyActivityDiversityCategory(item);
  const count = categoryCounts.get(key) ?? 0;
  const max =
    key === "bowling"
      ? ACTIVITIES_HOMEPAGE_MAX_BOWLING
      : ACTIVITIES_HOMEPAGE_MAX_PER_SUBTYPE;
  return count < max;
}

export type SelectHomepageActivitiesResult = {
  homepage: RankedDiscoveryItem[];
  ordered: RankedDiscoveryItem[];
};

/**
 * Select a diverse front-page spread from the verified Activities pool.
 */
export function selectEditorialHomepageActivities(
  items: readonly RankedDiscoveryItem[],
  options?: {
    maxTotal?: number;
    readerLocation?: ReaderLocation | null;
    deskTargets?: ActivitiesHomepageDeskTarget[];
  }
): SelectHomepageActivitiesResult {
  const maxTotal = options?.maxTotal ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  const readerLocation = options?.readerLocation ?? null;
  const deskTargets = options?.deskTargets ?? ACTIVITIES_HOMEPAGE_DESK_TARGETS;

  const eligible = filterEligibleActivitiesForDesk(items, readerLocation);
  if (eligible.length <= maxTotal) {
    const ordered = sortByHomepageRank([...eligible], readerLocation);
    return { homepage: ordered, ordered };
  }

  const deskIdeals = new Map(
    deskTargets.map((target) => [target.desk, target.ideal])
  );

  const { selected, remainder } = selectEditorialSpread(eligible, {
    maxSlots: maxTotal,
    getBaseScore: (item) => scoreActivityForHomepageSelection(item, readerLocation),
    getItemKey: activitySelectionKey,
    getVenueKey: activityVenueKey,
    getGeographyKey: activityGeographyKey,
    getCategoryKey: classifyActivityDiversityCategory,
    isCategoryEligible: isActivitySubtypeEligibleForHomepage,
    getCategoryTargetBoost: (item, categoryCounts) => {
      const desk = classifyActivityHomepageDesk(item);
      if (!desk) return 0;
      const ideal = deskIdeals.get(desk) ?? 0;
      const current = categoryCounts.get(classifyActivityDiversityCategory(item)) ?? 0;
      if (current < ideal) return DESK_TARGET_BOOST;
      return 0;
    },
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  });

  const tail = sortByHomepageRank(remainder, readerLocation);

  return {
    homepage: selected,
    ordered: [...selected, ...tail],
  };
}

export function curateActivitiesForHomepage(
  items: readonly RankedDiscoveryItem[],
  options?: {
    initialRenderCount?: number;
    readerLocation?: ReaderLocation | null;
  }
): RankedDiscoveryItem[] {
  const initialRenderCount =
    options?.initialRenderCount ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  const { ordered } = selectEditorialHomepageActivities(items, {
    maxTotal: initialRenderCount,
    readerLocation: options?.readerLocation,
  });
  return ordered;
}
