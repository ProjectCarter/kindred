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
  selectEditorialSpread,
} from "./editorialDiversity";

/** Editorial desks for a balanced front page — targets are ideals, not quotas. */
export type LocalEventsHomepageDesk =
  | "sports"
  | "music"
  | "festival_fair"
  | "arts_theater_comedy"
  | "community";

export type LocalEventsHomepageDeskTarget = {
  desk: LocalEventsHomepageDesk;
  /** Ideal slots when strong picks exist — unfilled slots roll to Editor's Choice. */
  ideal: number;
};

/** ~2 sports · ~2 concerts · 1 festival · 1 arts · 1 community · 1 editor's choice */
export const LOCAL_EVENTS_HOMEPAGE_DESK_TARGETS: LocalEventsHomepageDeskTarget[] = [
  { desk: "sports", ideal: 2 },
  { desk: "music", ideal: 2 },
  { desk: "festival_fair", ideal: 1 },
  { desk: "arts_theater_comedy", ideal: 1 },
  { desk: "community", ideal: 1 },
];

const FESTIVAL_FAIR_PATTERN =
  /\b(festival|fair|farmers?\s*market|night market|street fair|county fair|state fair|carnival|fiesta|celebration)\b/i;

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

/** Map a published event to an editorial desk, if any. */
export function classifyLocalEventHomepageDesk(
  event: LocalEventCard
): LocalEventsHomepageDesk | null {
  const category = event.category;
  const hay = `${event.name} ${event.venue}`.toLowerCase();

  if (category === "sports") return "sports";
  if (category === "music") return "music";
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
    resolveMajorLocalTeamHomepageBoost(event, options?.sportsMarketId)
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

  const published = events.filter((event) =>
    meetsLocalEventPublishThreshold(
      scoreEventForHomepageSelection(event, reference, { sportsMarketId })
    )
  );

  if (published.length <= maxTotal) {
    const ordered = sortByHomepageRank([...published], reference, sportsMarketId);
    return { homepage: ordered, ordered };
  }

  const deskIdeals = new Map(
    deskTargets.map((target) => [target.desk, target.ideal])
  );

  const { selected, remainder } = selectEditorialSpread(published, {
    maxSlots: maxTotal,
    getBaseScore: (event) =>
      scoreEventForHomepageSelection(event, reference, { sportsMarketId }),
    getItemKey: eventKey,
    getVenueKey: (event) => event.venue,
    getGeographyKey: (event) => event.city,
    getCategoryKey: classifyLocalEventDiversityCategory,
    isNearDuplicate: isSimilarLocalEventListing,
    getCategoryTargetBoost: (event, categoryCounts) => {
      const desk = classifyLocalEventHomepageDesk(event);
      if (!desk) return 0;
      const ideal = deskIdeals.get(desk) ?? 0;
      const current = categoryCounts.get(desk) ?? 0;
      if (current < ideal) return DESK_TARGET_BOOST;
      return 0;
    },
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  });

  const tail = sortByHomepageRank(remainder, reference, sportsMarketId);

  return {
    homepage: selected,
    ordered: [...selected, ...tail],
  };
}
