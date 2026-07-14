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
    /**
     * Normalized venue/business keys already introduced elsewhere on the page
     * (Local Events, Bandit's Pick) — the same business must never appear
     * twice in one edition (kindred-mission.mdc: no duplicates).
     */
    excludeVenueNames?: ReadonlySet<string>;
  }
): SectionAllocation {
  const max = options?.max ?? SECTION_MAX;
  const excludeVenueNames = options?.excludeVenueNames;
  // Sort by score up front — surfaces are concatenated in a fixed order
  // (coffee before museums before scenic drives, etc.), which used to mean
  // claim() effectively picked by surface order, not editorial quality.
  // "Experiences first" (kindred-recommendations.mdc) only means anything
  // if the highest-scored candidates — now boosted for real experiences
  // and penalized for chains — are actually considered first.
  const pool = dedupeById([
    ...fullCandidatePool(discovery),
    ...(extraItems ?? []),
  ])
    .filter((d) => !isRealEvent(d))
    // A card with no real title is broken, not beautiful — drop it rather
    // than render a blank headline (kindred-mission.mdc).
    .filter((d) => Boolean(d.item.title?.trim()))
    .filter((d) => {
      if (!excludeVenueNames?.size) return true;
      return !venueKeysForItem(d).some((key) => excludeVenueNames.has(key));
    })
    .sort((a, b) => b.score - a.score);
  const claimed = new Set<string>();

  /**
   * "Hard variety rule" (kindred-recommendations.mdc): never let one
   * category or venue subtype crowd a section — max two picks per key,
   * even if a third would otherwise outscore something more different.
   * `activities` collapses every Foursquare activity subtype into one
   * DiscoveryCategory, so it needs its own, more specific key (e.g.
   * "bowling alley") — every other category is specific enough already.
   */
  const MAX_PER_CATEGORY = 2;

  function varietyKey(item: RankedDiscoveryItem): string {
    if (item.item.category !== "activities") return item.item.category;
    const specific = item.item.venueCategories?.find((c) => c && c.trim());
    return specific ? specific.trim().toLowerCase() : "activities";
  }

  function claim(
    predicate: (item: RankedDiscoveryItem) => boolean,
    cap: number
  ): RankedDiscoveryItem[] {
    const picked: RankedDiscoveryItem[] = [];
    const perKey = new Map<string, number>();
    for (const item of pool) {
      if (picked.length >= cap) break;
      if (claimed.has(item.item.id)) continue;
      if (!predicate(item)) continue;
      const key = varietyKey(item);
      const count = perKey.get(key) ?? 0;
      if (count >= MAX_PER_CATEGORY) continue;
      picked.push(item);
      claimed.add(item.item.id);
      perKey.set(key, count + 1);
    }
    return picked;
  }

  const activities = claim(
    (item) =>
      ACTIVITIES_CATEGORIES.has(item.item.category) ||
      (CONTEXTUAL_CATEGORIES.has(item.item.category) && readsAsActive(item)),
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
