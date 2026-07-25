/**
 * Cross-section content allocator.
 *
 * Kindred's homepage sections used to draw independently from the same
 * shared discovery pool — each one re-scanning nearly the same surfaces —
 * so the same item could legitimately end up in Bandit's Notebook,
 * Experiences, Recommendations, and the Local Businesses desk all at
 * once. The paper felt small because it kept repeating itself.
 *
 * This module builds ONE full candidate pool (every surface, deduped)
 * and partitions it ONCE so every section gets a disjoint slice with its
 * own editorial purpose — not by venue type, but by what question the
 * reader is actually asking:
 *
 *   Local Events      — "What's happening this month?" Real, scheduled events
 *                        within the next 30 days. Not part of this allocator:
 *                        it reads edition_sections.local_events directly.
 *                        Every bucket below excludes real events so they never
 *                        duplicate here.
 *   Activities         — "What should I go do?" Recreational experiences within
 *                        25 miles — hiking, kayaking, museums, parks, beaches,
 *                        escape rooms, bowling, and every other participatory
 *                        venue. Never restaurants or food establishments.
 *   Bandit's Notebook   — discovery and hidden gems: the "experiences"
 *                        category outright, plus quiet media (books,
 *                        movies, podcasts) that reads as a personal find
 *                        rather than a place. Claims second, so this
 *                        locked section always has enough for a full
 *                        carousel.
 *   Food & Drink       — "Where should I eat and drink?" Coffee, restaurants,
 *                        bakeries, breweries, and every curated food experience.
 *                        Claims last, from what's left — so a venue already
 *                        claimed by Activities never also shows up here.
 *
 * Front Page (Lead + Top Stories) is untouched: it is a completely
 * separate pipeline (news wires + Story Editor) that never reads from
 * the discovery pool, so it cannot duplicate with any of the above.
 */

import type {
  DiscoveryCategory,
  DiscoveryPayload,
  DiscoverySurface,
  RankedDiscoveryItem,
} from "./discovery";
import { discoveryItemsForSurface } from "./discovery";
import {
  DISCOVERY_PUBLISH_MIN_SCORE,
  HOMEPAGE_INITIAL_RENDER_COUNT,
  sliceForInitialRender,
} from "./editorialPublishing";
import { meetsDiscoveryPublishConfidence } from "./editorialConfidence";
import {
  isActivityProShopParts,
  isParticipatoryActivityVenue,
  venueHayFromParts,
} from "./venueQuality";
import {
  compareByLocalProximity,
  DESTINATION_ACTIVITY_CATEGORIES,
  isWithinActivitiesSectionRadius,
  isWithinLocalDiscoveryRadius,
  RECOMMENDATION_CATEGORIES,
  resolveReaderLocation,
  type ReaderLocation,
} from "./localDiscoveryScope";
import { isFoodEstablishmentItem } from "./foodDrinkDesk";
import { isServiceBusinessListing } from "./serviceBusinessFilter";
import { isDiscoveryQualityExcluded } from "./discoveryQualityFilter";

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

/** "What should I go do?" — recreational experiences, never food establishments. */
const ACTIVITIES_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "hiking",
  "activities",
  ...DESTINATION_ACTIVITY_CATEGORIES,
]);

// Recipes read as "a personal find, not a place" — same territory as
// books/movies/podcasts — so they stay in the Notebook now that
// Recommendations is strictly "where should I go?" (venues only).
const NOTEBOOK_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "experiences",
  "books",
  "movies",
  "podcasts",
  "recipes",
]);

/** "Where should I eat and drink?" — food & drink only (internal key: recommendations). */
// RECOMMENDATION_CATEGORIES imported from localDiscoveryScope.ts

const DESTINATION_EXPERIENCE_CATEGORIES = DESTINATION_ACTIVITY_CATEGORIES;

/** Does this item belong in Activities — a real thing to go do? */
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

  if (DESTINATION_EXPERIENCE_CATEGORIES.has(item.item.category)) {
    return true;
  }

  if (item.item.category === "hiking") return true;

  if (item.item.category === "activities") {
    const hay = venueHayFromParts([
      item.item.title,
      item.item.dek,
      ...(item.item.venueCategories ?? []),
    ]);
    if (isActivityProShopParts([item.item.title, item.item.dek, ...(item.item.venueCategories ?? [])])) {
      return false;
    }
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

/** Flatten every surface into one deduped pool — the true candidate set. */
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

function normalizeVenueKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function venueKeysForItem(item: RankedDiscoveryItem): string[] {
  const keys = new Set<string>();
  const title = item.item.title?.trim();
  if (title) keys.add(normalizeVenueKey(title));
  return [...keys];
}

export type SectionAllocation = {
  /**
   * Full pool with real events removed, minus every item already claimed
   * below — safe base for smaller widgets (e.g. the Local Businesses desk)
   * that want a look at what's left without duplicating a named section.
   */
  nonEventItems: RankedDiscoveryItem[];
  activities: RankedDiscoveryItem[];
  notebook: RankedDiscoveryItem[];
  recommendations: RankedDiscoveryItem[];
};

/**
 * Partition the shared discovery pool once per edition render.
 * Priority order (Activities → Notebook → Recommendations) decides who
 * wins a contested item; everyone downstream only ever sees what's left.
 * Publication is quality-gated — every item above the editorial threshold
 * is included; no arbitrary section maximums or category quotas.
 */
export function allocateDiscoverySections(
  discovery: DiscoveryPayload | null | undefined,
  extraItems?: RankedDiscoveryItem[] | null,
  options?: {
    /**
     * Minimum discovery score required for publication in a section.
     * Defaults to DISCOVERY_PUBLISH_MIN_SCORE.
     */
    publishMinScore?: number;
    /**
     * Homepage initial render count — UI only. When set, each section's
     * returned array is sliced for first paint; the full published pool
     * remains in the edition. Omit (or pass Infinity) for the complete list.
     */
    initialRenderCount?: number;
    /**
     * @deprecated Use initialRenderCount — arbitrary section caps removed.
     */
    max?: number;
    excludeVenueNames?: ReadonlySet<string>;
    /** Reader position — Activities and Recommendations require coords within 25 mi. */
    readerLocation?: ReaderLocation | null;
  }
): SectionAllocation {
  const minScore = options?.publishMinScore ?? DISCOVERY_PUBLISH_MIN_SCORE;
  const initialRender =
    options?.initialRenderCount ??
    (options?.max != null && Number.isFinite(options.max)
      ? options.max
      : undefined);
  const excludeVenueNames = options?.excludeVenueNames;
  const readerLocation = resolveReaderLocation({
    readerLocation: options?.readerLocation ?? null,
    discovery,
  });
  const pool = dedupeById([
    ...fullCandidatePool(discovery),
    ...(extraItems ?? []),
  ])
    .filter((d) => !isRealEvent(d))
    .filter((d) => Boolean(d.item.title?.trim()))
    // Discovery Quality Filter (V3): one constitutional gate for every section —
    // restricted / service / editorially-excluded listings never reach Activities,
    // Food & Drinks, or Recommendations, even from an already-cached edition.
    .filter(
      (d) =>
        !isDiscoveryQualityExcluded({
          name: d.item.title,
          venueCategories: d.item.venueCategories,
          category: d.item.category,
          dek: d.item.dek,
        })
    )
    .filter((d) => d.score >= minScore)
    .filter((d) => meetsDiscoveryPublishConfidence(d.item))
    .filter((d) => {
      if (!excludeVenueNames?.size) return true;
      return !venueKeysForItem(d).some((key) => excludeVenueNames.has(key));
    })
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
    return initialRender != null && Number.isFinite(initialRender)
      ? sliceForInitialRender(picked, initialRender)
      : picked;
  }

  const activities = claim(
    (item) =>
      belongsInActivities(item) &&
      isWithinActivitiesSectionRadius(item, readerLocation)
  ).sort((a, b) => compareByLocalProximity(a, b, readerLocation));

  const notebook = claim((item) => NOTEBOOK_CATEGORIES.has(item.item.category));

  const recommendations = claim(
    (item) =>
      RECOMMENDATION_CATEGORIES.has(item.item.category) &&
      isWithinLocalDiscoveryRadius(item, readerLocation)
  ).sort((a, b) => compareByLocalProximity(a, b, readerLocation));

  return {
    nonEventItems: pool.filter((item) => !claimed.has(item.item.id)),
    activities,
    notebook,
    recommendations,
  };
}

export {
  DISCOVERY_PUBLISH_MIN_SCORE,
  HOMEPAGE_INITIAL_RENDER_COUNT,
};
