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
 *   Activities         — "What should I go do?" Real, bookable venues for
 *                        active participation within 25 miles — hiking, plus
 *                        the Activities desk (kayaking, escape rooms,
 *                        bowling, mini golf, rock climbing, axe
 *                        throwing, go-karts, pickleball) — plus any
 *                        beach/museum/scenic-drive item whose own
 *                        editorial note reads as something to *do*
 *                        (paddleboarding, a guided tour, a climb), not
 *                        just see. Claims first — this is the section's
 *                        clearest, most literal territory.
 *   Bandit's Notebook   — discovery and hidden gems: the "experiences"
 *                        category outright, plus quiet media (books,
 *                        movies, podcasts) that reads as a personal find
 *                        rather than a place. Claims second, so this
 *                        locked section always has enough for a full
 *                        carousel.
 *   Recommendations    — "Where should I go?" Places worth discovering within
 *                        25 miles: coffee, restaurants, bakeries, beaches,
 *                        parks, museums, scenic drives, gardens. Claims last,
 *                        from what's left — so a place already claimed
 *                        by Activities (e.g. a beach shown for
 *                        paddleboarding) never also shows up here.
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
  isParticipatoryActivityVenue,
  venueHayFromParts,
} from "./venueQuality";
import {
  compareByLocalProximity,
  isWithinActivitiesSectionRadius,
  isWithinLocalDiscoveryRadius,
  RECOMMENDATION_CATEGORIES,
  resolveReaderLocation,
  type ReaderLocation,
} from "./localDiscoveryScope";

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

/** "What should I go do?" — active participation, not just a place to look at. */
const ACTIVITIES_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "hiking",
  "activities",
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

/** "Where should I go?" — places worth discovering, not activities to do. */
// RECOMMENDATION_CATEGORIES imported from localDiscoveryScope.ts


/**
 * A handful of categories are editorially ambiguous — the same beach can
 * be an Activity (a great place to paddleboard) or a Recommendation (a
 * beautiful place to see), depending on why it's actually being featured.
 * Rather than a rigid category → section map, read Kindred's own editorial
 * note for that item: if it frames the place around active participation
 * it belongs in Activities; otherwise it falls through to Recommendations,
 * where a place worth discovering naturally belongs.
 */
const CONTEXTUAL_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "beaches",
  "museums",
  "scenic_drives",
]);

const ACTIVE_PARTICIPATION_PATTERN =
  /paddleboard|paddle board|kayak|surf|snorkel|scuba|dive|swim|hike|hiking|trail|climb|bike|cycling|kite|sail|canoe|walking tour|guided tour|workshop|class\b/i;

/** Does this item belong in Activities — a real thing to go do? */
function belongsInActivities(item: RankedDiscoveryItem): boolean {
  if (ACTIVITIES_CATEGORIES.has(item.item.category)) {
    if (item.item.category === "hiking") return true;
    const hay = venueHayFromParts([
      item.item.title,
      item.item.dek,
      ...(item.item.venueCategories ?? []),
    ]);
    return isParticipatoryActivityVenue(hay);
  }
  if (
    CONTEXTUAL_CATEGORIES.has(item.item.category) &&
    readsAsActive(item)
  ) {
    return true;
  }
  return false;
}

/** Does this item's own copy frame it as something to *do*, not just see? */
function readsAsActive(item: RankedDiscoveryItem): boolean {
  const hay = [item.item.title, item.item.dek, ...(item.item.venueCategories ?? [])]
    .filter(Boolean)
    .join(" ");
  return ACTIVE_PARTICIPATION_PATTERN.test(hay);
}

/** Real, scheduled local events — these belong to Local Events only. */
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
