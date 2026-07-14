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
 *   Local Events      — "What's happening today?" Real, scheduled events
 *                        only. Not part of this allocator: it reads
 *                        edition_sections.local_events directly. Every
 *                        bucket below excludes real events so they never
 *                        duplicate here.
 *   Activities         — "What should I go do?" Real, bookable venues for
 *                        active participation: hiking, plus the
 *                        Activities desk (kayaking, escape rooms,
 *                        bowling, mini golf, rock climbing, axe
 *                        throwing, go-karts, pickleball). Claims first —
 *                        this is the section's clearest, most literal
 *                        territory.
 *   Bandit's Notebook   — discovery and hidden gems: the "experiences"
 *                        category outright, plus quiet media (books,
 *                        movies, podcasts) that reads as a personal find
 *                        rather than a place. Claims second, so this
 *                        locked section always has enough for a full
 *                        carousel.
 *   Recommendations    — "Where should I go?" Places worth discovering:
 *                        coffee, restaurants, bakeries, beaches, parks,
 *                        museums, scenic drives, gardens. Claims last,
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
const RECOMMENDATION_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "restaurants",
  "coffee",
  "bakeries",
  "beaches",
  "parks",
  "museums",
  "scenic_drives",
  "gardens",
]);

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

/** Per-section cap — matches Local Events' "up to 8, then See More" rhythm. */
const SECTION_MAX = 8;

/**
 * Partition the shared discovery pool once per edition render.
 * Priority order (Activities → Notebook → Recommendations) decides who
 * wins a contested item; everyone downstream only ever sees what's left,
 * so no item can appear in more than one of these three sections — a
 * beach claimed by Activities (shown for paddleboarding) can never also
 * turn up in Recommendations (shown for its view). Notebook claims before
 * Recommendations specifically so this locked carousel always has enough
 * depth, even on a thin catalog day.
 */
export function allocateDiscoverySections(
  discovery: DiscoveryPayload | null | undefined,
  extraItems?: RankedDiscoveryItem[] | null,
  options?: {
    /**
     * Override the per-section cap. The front page always uses
     * SECTION_MAX (8); a "See all" destination screen passes Infinity
     * here to get every claimed item under the same editorial priority
     * (Activities → Notebook → Recommendations), not just the front
     * page's first 8.
     */
    max?: number;
  }
): SectionAllocation {
  const max = options?.max ?? SECTION_MAX;
  const pool = dedupeById([
    ...fullCandidatePool(discovery),
    ...(extraItems ?? []),
  ]).filter((d) => !isRealEvent(d));
  const claimed = new Set<string>();

  function claim(
    predicate: (item: RankedDiscoveryItem) => boolean,
    cap: number
  ): RankedDiscoveryItem[] {
    const picked: RankedDiscoveryItem[] = [];
    for (const item of pool) {
      if (picked.length >= cap) break;
      if (claimed.has(item.item.id)) continue;
      if (!predicate(item)) continue;
      picked.push(item);
      claimed.add(item.item.id);
    }
    return picked;
  }

  const activities = claim(
    (item) => ACTIVITIES_CATEGORIES.has(item.item.category),
    max
  );

  const notebook = claim(
    (item) => NOTEBOOK_CATEGORIES.has(item.item.category),
    max
  );

  const recommendations = claim(
    (item) => RECOMMENDATION_CATEGORIES.has(item.item.category),
    max
  );

  return {
    nonEventItems: pool.filter((item) => !claimed.has(item.item.id)),
    activities,
    notebook,
    recommendations,
  };
}
