/**
 * Homepage Local Events — newspaper-style front-page selection.
 *
 * Picks the first N cards for the homepage grid from the frozen edition pool.
 * Does not change retrieval, scoring, validation, or See All ordering.
 */

import type { LocalEventCard } from "./localEvents";
import { authorizedEventImageUrl } from "./localEvents";
import {
  parseEventStartDate,
  resolveCardHorizon,
} from "./eventHorizon";
import { meetsLocalEventPublishThreshold } from "./editorialPublishing";
import { resolveMajorLocalTeamHomepageBoost } from "./majorLocalTeams";
import {
  LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  normalizeSpreadKey,
  selectEditorialSpread,
} from "./editorialDiversity";
import {
  assessLocalEventHomepageEditorial,
  filterLocalEventsForHomepageCuration,
} from "./localEventsHomepageEditorial";

/** Editorial desks for a balanced front page — targets are ideals, not quotas. */
export type LocalEventsHomepageDesk =
  | "sports"
  | "music"
  | "festival_fair"
  | "arts_theater_comedy"
  | "history"
  | "community";

export type LocalEventsHomepageDeskTarget = {
  desk: LocalEventsHomepageDesk;
  /** Ideal slots when strong picks exist — unfilled slots roll to Editor's Choice. */
  ideal: number;
};

/** Balanced front page — memorable experiences across desks, not directory filler. */
export const LOCAL_EVENTS_HOMEPAGE_DESK_TARGETS: LocalEventsHomepageDeskTarget[] = [
  { desk: "music", ideal: 2 },
  { desk: "festival_fair", ideal: 1 },
  { desk: "sports", ideal: 1 },
  { desk: "arts_theater_comedy", ideal: 1 },
  { desk: "history", ideal: 1 },
  { desk: "community", ideal: 1 },
];

const FESTIVAL_FAIR_PATTERN =
  /\b(festival|fair|farmers?\s*market|night market|street fair|county fair|state fair|carnival|fiesta|celebration|food festival|beer festival|wine tasting)\b/i;

const HISTORY_COMMUNITY_PATTERN =
  /\b(ghost walk|historic tour|heritage walk|walking tour|historic district|living history)\b/i;

const ARTS_THEATER_PATTERN =
  /\b(theater|theatre|broadway|play\b|musical|opera|ballet|symphony|orchestra|stand[- ]?up|comedy show)\b/i;

const STOP_WORDS = new Set([
  "the", "a", "an", "at", "in", "on", "of", "and", "with", "to", "for", "vs",
]);

function eventKey(event: LocalEventCard): string {
  return `${event.name.trim().toLowerCase()}|${event.date.trim().toLowerCase()}|${event.venue.trim().toLowerCase()}`;
}

export function localEventSelectionKey(event: LocalEventCard): string {
  return eventKey(event);
}

function significantWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );
}

export function isSimilarLocalEventListing(a: LocalEventCard, b: LocalEventCard): boolean {
  if (a.venue.trim().toLowerCase() !== b.venue.trim().toLowerCase()) return false;
  const wordsA = significantWords(a.name);
  const wordsB = significantWords(b.name);
  if (!wordsA.size || !wordsB.size) return false;
  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.72;
}

/** Max picks from any single desk/category bucket on the homepage grid. */
export const LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY = 2;

export function hasHomepageReaderEditorial(
  event: Pick<LocalEventCard, "banditNote" | "editorialBody">
): boolean {
  return Boolean(
    event.banditNote?.trim() &&
      Array.isArray(event.editorialBody) &&
      event.editorialBody.length > 0
  );
}

export function isLocalEventCategoryEligibleForHomepage(
  event: LocalEventCard,
  categoryCounts: ReadonlyMap<string, number>
): boolean {
  const key = classifyLocalEventDiversityCategory(event);
  const count = categoryCounts.get(key) ?? 0;
  return count < LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY;
}

export function homepageVenueKey(venue: string | null | undefined): string | null {
  const normalized = normalizeSpreadKey(venue);
  if (!normalized) return null;
  if (normalized.includes("regus") && normalized.includes("phoenix")) {
    return "regus phoenix";
  }
  if (normalized.includes("mic drop comedy")) {
    return "mic drop comedy";
  }
  return normalized;
}

/** Hard caps after spread selection — max two per desk/category, one per venue. */
export function enforceLocalEventsHomepageSpreadCaps(
  candidates: readonly LocalEventCard[],
  options?: {
    maxTotal?: number;
    reference?: Date;
    sportsMarketId?: string | null;
  }
): LocalEventCard[] {
  const maxTotal = options?.maxTotal ?? 8;
  const reference = options?.reference ?? new Date();
  const sportsMarketId = options?.sportsMarketId ?? null;
  const ranked = sortByHomepageRank([...candidates], reference, sportsMarketId);
  const picked: LocalEventCard[] = [];
  const categoryCounts = new Map<string, number>();
  const venues = new Set<string>();

  for (const event of ranked) {
    if (picked.length >= maxTotal) break;
    const category = classifyLocalEventDiversityCategory(event);
    if ((categoryCounts.get(category) ?? 0) >= LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY) {
      continue;
    }
    const venue = homepageVenueKey(event.venue);
    if (venue && venues.has(venue)) continue;
    if (picked.some((row) => isSimilarLocalEventListing(row, event))) continue;

    picked.push(event);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    if (venue) venues.add(venue);
  }

  return picked;
}

/** Map a published event to an editorial desk, if any. */
export function classifyLocalEventHomepageDesk(
  event: LocalEventCard
): LocalEventsHomepageDesk | null {
  const category = event.category;
  const hay = `${event.name} ${event.venue}`.toLowerCase();

  if (category === "sports") return "sports";
  if (category === "music") return "music";
  if (HISTORY_COMMUNITY_PATTERN.test(hay)) return "history";
  if (
    category === "market" ||
    FESTIVAL_FAIR_PATTERN.test(hay)
  ) {
    return "festival_fair";
  }
  if (
    category === "arts" ||
    category === "comedy" ||
    ARTS_THEATER_PATTERN.test(hay)
  ) {
    return "arts_theater_comedy";
  }
  if (category === "community" || category === "family") return "community";
  if (category === "food") return "festival_fair";
  return null;
}

/** Diversity bucket for homepage spread — desk when known, else provider category. */
export function classifyLocalEventDiversityCategory(event: LocalEventCard): string {
  return classifyLocalEventHomepageDesk(event) ?? event.category ?? "other";
}

function timelinessBoost(
  event: LocalEventCard,
  reference: Date
): number {
  const bucket = resolveCardHorizon(event, reference);
  switch (bucket) {
    case "today":
      return 4;
    case "this_weekend":
      return 3;
    case "next_weekend":
      return 2;
    case "coming_soon":
      return 1;
    default:
      return 0;
  }
}

function daysOutBoost(event: LocalEventCard, reference: Date): number {
  const parsed = parseEventStartDate(
    `${event.date} ${event.time ?? ""}`.trim(),
    event.startDateIso,
    reference
  );
  if (!parsed) return 0;
  const ms =
    parsed.getTime() -
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  const daysOut = Math.round(ms / (24 * 60 * 60 * 1000));
  if (daysOut < 0) return -8;
  if (daysOut === 0) return 6;
  if (daysOut === 1) return 5;
  if (daysOut <= 3) return 4;
  if (daysOut <= 7) return 3;
  if (daysOut <= 14) return 2;
  if (daysOut <= 21) return 1;
  return 0;
}

/**
 * Composite rank for homepage desk picks — editorial quality first,
 * then timeliness. Uses frozen edition editorialScore when present.
 */
export function scoreEventForHomepageSelection(
  event: LocalEventCard,
  reference: Date = new Date(),
  options?: { sportsMarketId?: string | null }
): number {
  const editorial =
    typeof event.editorialScore === "number" && Number.isFinite(event.editorialScore)
      ? event.editorialScore
      : fallbackHomepageScore(event, reference);

  return (
    editorial +
    timelinessBoost(event, reference) +
    daysOutBoost(event, reference) +
    resolveMajorLocalTeamHomepageBoost(event, options?.sportsMarketId) +
    assessLocalEventHomepageEditorial(event).memorableBoost
  );
}

function fallbackHomepageScore(event: LocalEventCard, reference: Date): number {
  const bucket = resolveCardHorizon(event, reference);
  let score = 0;
  if (bucket === "today") score += 40;
  else if (bucket === "this_weekend") score += 30;
  else if (bucket === "next_weekend") score += 20;
  else score += 10;
  if (authorizedEventImageUrl(event)) score += 12;
  else if (event.imageUrl) score += 1;
  if (event.banditNote?.trim()) score += 2;
  if (event.editorialHeadline?.trim()) score += 2;
  return score;
}

function sortByHomepageRank(
  events: LocalEventCard[],
  reference: Date,
  sportsMarketId?: string | null
): LocalEventCard[] {
  return [...events].sort(
    (a, b) =>
      scoreEventForHomepageSelection(b, reference, { sportsMarketId }) -
      scoreEventForHomepageSelection(a, reference, { sportsMarketId })
  );
}

const DESK_TARGET_BOOST = 14;

export type SelectHomepageLocalEventsResult = {
  /** First N cards for the homepage grid — editorially balanced. */
  homepage: LocalEventCard[];
  /** Full edition order: homepage slice first, then remaining by editorial rank. */
  ordered: LocalEventCard[];
};

/**
 * Select a diverse front-page spread from the frozen edition pool.
 * Desk ideals, venue caps, geography, and category variety via editorialDiversity.
 */
export function selectEditorialHomepageLocalEvents(
  events: readonly LocalEventCard[],
  options?: {
    maxTotal?: number;
    reference?: Date;
    deskTargets?: LocalEventsHomepageDeskTarget[];
    sportsMarketId?: string | null;
  }
): SelectHomepageLocalEventsResult {
  const maxTotal = options?.maxTotal ?? 8;
  const reference = options?.reference ?? new Date();
  const deskTargets = options?.deskTargets ?? LOCAL_EVENTS_HOMEPAGE_DESK_TARGETS;
  const sportsMarketId = options?.sportsMarketId ?? null;

  const published = filterLocalEventsForHomepageCuration(
    events.filter(
      (event) =>
        hasHomepageReaderEditorial(event) &&
        meetsLocalEventPublishThreshold(
          scoreEventForHomepageSelection(event, reference, { sportsMarketId })
        )
    )
  );

  if (published.length <= maxTotal) {
    const ordered = enforceLocalEventsHomepageSpreadCaps(published, {
      maxTotal: published.length,
      reference,
      sportsMarketId,
    });
    return { homepage: ordered, ordered };
  }

  const deskIdeals = new Map(
    deskTargets.map((target) => [target.desk, target.ideal])
  );

  const spreadConfig = {
    maxSlots: maxTotal,
    getBaseScore: (event: LocalEventCard) =>
      scoreEventForHomepageSelection(event, reference, { sportsMarketId }),
    getItemKey: eventKey,
    getVenueKey: (event: LocalEventCard) => event.venue,
    getGeographyKey: (event: LocalEventCard) => event.city,
    getCategoryKey: classifyLocalEventDiversityCategory,
    isCategoryEligible: isLocalEventCategoryEligibleForHomepage,
    isNearDuplicate: isSimilarLocalEventListing,
    getCategoryTargetBoost: (
      event: LocalEventCard,
      categoryCounts: ReadonlyMap<string, number>
    ) => {
      const desk = classifyLocalEventHomepageDesk(event);
      if (!desk) return 0;
      const ideal = deskIdeals.get(desk) ?? 0;
      const current = categoryCounts.get(desk) ?? 0;
      if (current < ideal) return DESK_TARGET_BOOST;
      return 0;
    },
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  };

  const { selected, remainder } = selectEditorialSpread(published, spreadConfig);

  const orderedTail = sortByHomepageRank(remainder, reference, sportsMarketId);
  const homepage = enforceLocalEventsHomepageSpreadCaps(
    selected.length
      ? [
          ...selected,
          ...sortByHomepageRank(remainder, reference, sportsMarketId).filter(
            (event) =>
              !selected.some(
                (picked) => localEventSelectionKey(picked) === localEventSelectionKey(event)
              )
          ),
        ]
      : published,
    {
      maxTotal,
      reference,
      sportsMarketId,
    }
  );

  return {
    homepage,
    ordered: [
      ...homepage,
      ...orderedTail.filter(
        (event) =>
          !homepage.some(
            (picked) => localEventSelectionKey(picked) === localEventSelectionKey(event)
          )
      ),
      ...selected.filter(
        (event) =>
          !homepage.some(
            (picked) => localEventSelectionKey(picked) === localEventSelectionKey(event)
          )
      ),
    ],
  };
}
