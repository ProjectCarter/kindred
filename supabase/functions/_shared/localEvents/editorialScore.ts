/**
 * Kindred Editorial Score — every discovered event gets a transparent score.
 *
 * Discovery should be comprehensive; ranking should be editorial.
 * The editorial question: "If someone only had one free afternoon or evening
 * this week, is this an experience we would genuinely recommend?"
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { KINDRED_LOCAL_RADIUS_KM, KINDRED_LOCAL_RADIUS_MILES } from "../editorial/editorialStandard.ts";
import { haversineKm } from "../discovery/geo.ts";
import {
  isGenericEventTitle,
  venueHayFromParts,
} from "../editorial/venueQuality.ts";
import type { LocalEvent } from "./provider.ts";
import { trustScoreForSource } from "./sources/types.ts";
import {
  type EventHorizonBucket,
  parseEventStartDate,
  startOfLocalDay,
  daysBetween,
  EVENT_HORIZON_DAYS,
} from "./horizon.ts";

export type KindredEventScoreReason = {
  code: string;
  label: string;
  weight: number;
};

export type KindredEventEditorialDimensions = {
  editorialQuality: number;
  localRelevance: number;
  communityInterest: number;
  uniqueness: number;
  timeliness: number;
  seasonalRelevance: number;
  worthLeavingHouse: number;
  familyFriendliness: number;
};

export type KindredEventEditorialScore = {
  total: number;
  dimensions: KindredEventEditorialDimensions;
  penalties: number;
  reasons: KindredEventScoreReason[];
};

const EXPERIENCE_FIRST_PATTERN =
  /\b(concert|live music|festival|fair|farmers?\s*market|food festival|night market|comedy|theater|theatre|play\b|broadway|symphony|orchestra|marathon|5k|10k|triathlon|car show|auto show|parade|block party|street fair|county fair|state fair|cultural festival|community celebration|exhibit|exhibition|brewery event|u-pick|harvest|fireworks|tree lighting|holiday market|wrestling|strongman|tournament|amphitheater|headliner|food truck)\b/i;

const SEASONAL_PATTERN =
  /\b(festival|fair|parade|farmers market|holiday|seasonal|summer concert|winter|spring|autumn|harvest|christmas|halloween|fourth of july|memorial day|labor day|blueberry|strawberry|peach season)\b/i;

const UNIQUE_PATTERN =
  /\b(first annual|one.?night only|limited|premiere|opening night|debut|exclusive|only|rare|unique|annual)\b/i;

const FAMILY_PATTERN =
  /\b(kids|children|family|storytime|petting zoo|carnival|toddler|all ages)\b/i;

const COMMUNITY_PATTERN =
  /\b(community|neighborhood|local|charity|fundraiser|volunteer|town hall|civic|nonprofit|benefit)\b/i;

const EDUCATIONAL_PATTERN =
  /\b(workshop|lecture|class|learn|science|history|museum|gallery|author talk|guided tour|demonstration|planetarium)\b/i;

const LOW_PRIORITY_PATTERN =
  /\b(networking event|networking night|job fair|hiring event|career fair|trade show|business conference|industry conference|vendor expo|professional development|resume workshop|recruiting event|b2b expo|sweepstakes|%\s*off|limited time offer|buy one get|clearance sale|grand opening sale|free seminar|lead generation|mlm|multi[- ]level|cannabis business networking)\b/i;

const ORDINARY_BUSINESS_PATTERN =
  /\b(open house|ribbon cutting|store opening|grand opening(?! sale)|happy hour at|dine at|coffee at|paint and sip at)\b/i;

const OFFICIAL_SOURCE_PATTERN =
  /\b(ticketmaster|eventbrite|axs|dice\.fm|city of|county|library|museum|botanical|university|college|\.gov|\.edu)\b/i;

const OUTDOOR_EVENT_PATTERN =
  /\b(festival|farmers market|outdoor|concert|marathon|race|parade|fair|market|5k|10k|park|garden tour|food truck|block party|street fair|amphitheater|tailgate|soccer|baseball)\b/i;

const EAST_VALLEY_METRO =
  /\b(gilbert|mesa|chandler|tempe|queen creek|san tan valley|apache junction|fountain hills|scottsdale)\b/i;

function isOutdoorEvent(event: LocalEvent): boolean {
  if (event.category === "market" || event.category === "sports") return true;
  const hay = `${event.name} ${event.venue} ${event.category ?? ""}`;
  return OUTDOOR_EVENT_PATTERN.test(hay);
}

function timelinessPoints(
  event: LocalEvent,
  now: Date,
  horizonBucket?: EventHorizonBucket | null
): number {
  const parsed = parseEventStartDate(
    event.startDateTime,
    event.startDateIso,
    now
  );
  if (parsed) {
    const daysOut = daysBetween(startOfLocalDay(now), parsed);
    if (daysOut < 0 || daysOut > EVENT_HORIZON_DAYS) return -20;
    if (daysOut === 0) return 22;
    if (daysOut === 1) return 18;
    if (daysOut <= 3) return 14;
    if (daysOut <= 7) return 11;
    if (daysOut <= 14) return 8;
    if (daysOut <= 21) return 5;
    return 3;
  }

  const raw = event.startDateTime.trim().toLowerCase();
  if (!raw || raw === "time tba" || raw === "date tba") return -4;

  switch (horizonBucket) {
    case "today":
      return 20;
    case "this_weekend":
      return 14;
    case "next_weekend":
      return 10;
    case "coming_soon":
      return 6;
    default:
      if (/\bthis week\b|\bweekend\b/.test(raw)) return 4;
      return 0;
  }
}

function localRelevancePoints(
  event: LocalEvent,
  readerCity: string | null,
  readerLat?: number | null,
  readerLon?: number | null
): { score: number; reasons: KindredEventScoreReason[] } {
  const hay = venueHayFromParts([event.name, event.venue, event.city]);
  const reasons: KindredEventScoreReason[] = [];
  let score = 0;
  const reader = readerCity?.trim().toLowerCase() ?? "";
  const eventCity = event.city?.trim().toLowerCase() ?? "";

  if (reader && (eventCity.includes(reader) || hay.includes(reader))) {
    score += 14;
    reasons.push({
      code: "reader_city_match",
      label: "In the reader's city",
      weight: 14,
    });
  } else if (
    reader &&
    EAST_VALLEY_METRO.test(reader) &&
    EAST_VALLEY_METRO.test(hay)
  ) {
    score += 10;
    reasons.push({
      code: "metro_suburb",
      label: "Within the local metro",
      weight: 10,
    });
  } else if (event.lat != null && event.lon != null && readerLat != null && readerLon != null) {
    const km = haversineKm(readerLat, readerLon, event.lat, event.lon);
    if (km > KINDRED_LOCAL_RADIUS_KM) {
      score -= 28;
      reasons.push({
        code: "outside_radius",
        label: `Outside the ${KINDRED_LOCAL_RADIUS_MILES}-mile local paper`,
        weight: -28,
      });
    } else if (km > 20) {
      score += 4;
      reasons.push({
        code: "nearby_suburb",
        label: "Nearby suburb within the local radius",
        weight: 4,
      });
    } else {
      score += 10;
      reasons.push({
        code: "close_to_reader",
        label: "Close to the reader",
        weight: 10,
      });
    }
  } else if (reader && eventCity && eventCity !== reader) {
    score -= 14;
    reasons.push({
      code: "distant_city",
      label: "Different city from the reader",
      weight: -14,
    });
  } else if (event.city?.trim()) {
    score += 4;
  }

  if (event.sourceTier === "official") {
    score += 6;
    reasons.push({
      code: "official_source",
      label: "Official source listing",
      weight: 6,
    });
  } else if (OFFICIAL_SOURCE_PATTERN.test(`${event.sourceUrl} ${event.sourceName}`)) {
    score += 4;
  }

  return { score: Math.min(Math.max(score, -30), 20), reasons };
}

function communityInterestPoints(event: LocalEvent): number {
  const rating = event.venueRating;
  const reviews = event.venueReviewCount ?? 0;
  if (rating != null && rating >= 4.3 && reviews >= 25) return 8;
  if (rating != null && rating >= 4.0 && reviews >= 10) return 5;
  if (reviews >= 50) return 3;
  return 0;
}

function worthLeavingHousePoints(event: LocalEvent): { score: number; reasons: KindredEventScoreReason[] } {
  const hay = venueHayFromParts([event.name, event.venue, event.category, event.banditNote]);
  const reasons: KindredEventScoreReason[] = [];
  let score = 0;

  if (EXPERIENCE_FIRST_PATTERN.test(hay)) {
    score += 18;
    reasons.push({
      code: "experience_first",
      label: "Worth leaving the house for",
      weight: 18,
    });
  }

  if (event.category === "music" || event.category === "comedy" || event.category === "market") {
    score += 6;
  }

  if (LOW_PRIORITY_PATTERN.test(hay)) {
    score -= 28;
    reasons.push({
      code: "low_priority_event",
      label: "Held back — networking or promotion, not an outing",
      weight: -28,
    });
  }

  if (ORDINARY_BUSINESS_PATTERN.test(hay) && !EXPERIENCE_FIRST_PATTERN.test(hay)) {
    score -= 12;
    reasons.push({
      code: "ordinary_business",
      label: "Ordinary business listing — not a special event",
      weight: -12,
    });
  }

  return { score, reasons };
}

function editorialQualityPoints(event: LocalEvent): { score: number; reasons: KindredEventScoreReason[] } {
  const reasons: KindredEventScoreReason[] = [];
  let score = 0;

  if (event.sourceUrl?.trim()) score += 6;
  if (event.venue?.trim() && event.venue.trim() !== "Venue TBA") score += 4;
  if (event.city?.trim()) score += 2;
  if (
    event.startDateTime.trim() &&
    event.startDateTime !== "Time TBA" &&
    event.startDateTime !== "Date TBA"
  ) {
    score += 6;
  }
  if (event.banditNote?.trim()) score += 3;
  if (event.imageRights?.authorized && event.imageUrl?.trim()) {
    score += 12;
    reasons.push({
      code: "authorized_image",
      label: "Authorized listing photography",
      weight: 12,
    });
  } else if (event.imageUrl?.trim()) {
    score += 1;
  }

  if (event.sourceId === "ticketmaster") {
    score += 8;
    reasons.push({
      code: "ticketmaster",
      label: "Ticketmaster verified listing",
      weight: 8,
    });
  }

  if (isGenericEventTitle(event.name)) {
    score -= 12;
    reasons.push({
      code: "generic_title",
      label: "Generic title — thin editorial signal",
      weight: -12,
    });
  }

  const venue = event.venue?.trim().toLowerCase() ?? "";
  if (!venue || venue === "venue tba") {
    score -= 10;
    reasons.push({ code: "venue_tba", label: "Venue not confirmed", weight: -10 });
  }

  const schedule = event.startDateTime.trim().toLowerCase();
  if (schedule === "time tba" || schedule === "date tba") {
    score -= 8;
    reasons.push({ code: "schedule_tba", label: "Date or time not confirmed", weight: -8 });
  }

  if (event.sourceTier === "official") score += 8;
  else if (event.sourceTier === "venue") score += 4;
  else if (trustScoreForSource(event.sourceId) >= 90) score += 6;

  return { score, reasons };
}

function weatherAdjustment(
  event: LocalEvent,
  intel: WeatherIntelligence | null | undefined
): number {
  if (!intel || !isOutdoorEvent(event)) return 0;
  if (intel.isRainy || intel.isStormy || intel.severeWeather) return -14;
  if (intel.isWindy) return -4;
  if (intel.bucket === "fair" && !intel.isHot) return 5;
  return 0;
}

export function computeKindredEventEditorialScore(
  event: LocalEvent,
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
    horizonBucket?: EventHorizonBucket | null;
    readerCity?: string | null;
    readerLat?: number | null;
    readerLon?: number | null;
  }
): KindredEventEditorialScore {
  const now = options?.now ?? new Date();
  const hay = venueHayFromParts([event.name, event.venue, event.category, event.sourceName]);
  const reasons: KindredEventScoreReason[] = [];

  const timeliness = timelinessPoints(
    event,
    now,
    options?.horizonBucket ?? event.horizonBucket
  );
  if (timeliness > 0) {
    reasons.push({
      code: "timeliness",
      label: "On the calendar this month",
      weight: timeliness,
    });
  }

  const { score: qualityScore, reasons: qualityReasons } = editorialQualityPoints(event);
  reasons.push(...qualityReasons);

  let seasonalRelevance = 0;
  if (SEASONAL_PATTERN.test(hay)) {
    seasonalRelevance = 8;
    reasons.push({ code: "seasonal", label: "Seasonal or limited window", weight: 8 });
  }

  let uniqueness = 0;
  if (UNIQUE_PATTERN.test(hay)) {
    uniqueness = 6;
    reasons.push({ code: "unique", label: "Feels one-of-a-kind", weight: 6 });
  }

  let familyFriendliness = 0;
  if (event.category === "family" || FAMILY_PATTERN.test(hay)) {
    familyFriendliness = 7;
    reasons.push({ code: "family_friendly", label: "Good for families", weight: 7 });
  }

  if (COMMUNITY_PATTERN.test(hay)) {
    reasons.push({ code: "community", label: "Community gathering", weight: 4 });
  }

  if (EDUCATIONAL_PATTERN.test(hay)) {
    reasons.push({ code: "educational", label: "Learn something new", weight: 4 });
  }

  if (event.badges?.includes("free")) {
    reasons.push({ code: "free", label: "Free to attend", weight: 6 });
  }

  const localRelevanceResult = localRelevancePoints(
    event,
    options?.readerCity ?? event.city ?? null,
    options?.readerLat,
    options?.readerLon
  );
  const localRelevance = localRelevanceResult.score;
  if (localRelevanceResult.reasons.length) {
    reasons.push(...localRelevanceResult.reasons);
  }

  const communityInterest = communityInterestPoints(event);
  if (communityInterest > 0) {
    reasons.push({
      code: "community_interest",
      label: "Locals already show up here",
      weight: communityInterest,
    });
  }

  const { score: worthLeavingHouse, reasons: experienceReasons } =
    worthLeavingHousePoints(event);
  reasons.push(...experienceReasons);

  const discoveryBonus =
    (COMMUNITY_PATTERN.test(hay) ? 4 : 0) +
    (EDUCATIONAL_PATTERN.test(hay) ? 4 : 0) +
    (event.badges?.includes("free") ? 6 : 0) +
    (/\b(concert|market|food truck|art walk|block party)\b/i.test(hay) ? 3 : 0);

  const weather = weatherAdjustment(event, options?.weatherIntel);
  if (weather !== 0) {
    reasons.push({
      code: "weather",
      label: weather > 0 ? "Suits the forecast" : "Outdoor pick held back for weather",
      weight: weather,
    });
  }

  const dimensions: KindredEventEditorialDimensions = {
    editorialQuality: qualityScore,
    localRelevance,
    communityInterest,
    uniqueness,
    timeliness,
    seasonalRelevance,
    worthLeavingHouse,
    familyFriendliness,
  };

  const penalties = reasons.filter((r) => r.weight < 0).reduce((n, r) => n + r.weight, 0);

  const total =
    qualityScore +
    localRelevance +
    communityInterest +
    uniqueness +
    timeliness +
    seasonalRelevance +
    worthLeavingHouse +
    familyFriendliness +
    discoveryBonus +
    weather;

  return {
    total: Math.round(total),
    dimensions,
    penalties,
    reasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
  };
}

/** Backward-compatible scalar score for ranking gates. */
export function scalarEventEditorialScore(
  event: LocalEvent,
  options?: Parameters<typeof computeKindredEventEditorialScore>[1]
): number {
  return computeKindredEventEditorialScore(event, options).total;
}
