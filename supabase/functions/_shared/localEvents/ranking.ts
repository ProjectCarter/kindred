/**
 * Editorial ranking for Local Events — confirmed facts first, then
 * timeliness, then weather suitability for outdoor listings.
 * Images influence tie-breaks only; they never fabricate event facts.
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../editorial/publishing.ts";
import {
  isGenericEventTitle,
  venueHayFromParts,
} from "../editorial/venueQuality.ts";
import type { LocalEvent } from "./provider.ts";
import { trustScoreForSource } from "./sources/types.ts";

const SEASONAL_PATTERN =
  /\b(festival|fair|parade|farmers market|holiday|seasonal|summer concert|winter|spring|autumn|harvest|christmas|halloween|fourth of july|memorial day|labor day)\b/i;

const UNIQUE_PATTERN =
  /\b(first annual|one.?night only|limited|premiere|opening night|debut|exclusive|only|rare|unique)\b/i;

const EDUCATIONAL_PATTERN =
  /\b(workshop|lecture|class|learn|science|history|museum|gallery|author talk|storytime|guided tour|demonstration|planetarium)\b/i;

const COMMUNITY_PATTERN =
  /\b(community|neighborhood|local|charity|fundraiser|volunteer|town hall|civic|nonprofit|benefit)\b/i;

const RECURRING_FAVORITE_PATTERN =
  /\b(annual|tradition|every (year|month|week)|recurring|classic|beloved|staple)\b/i;

const DRIVE_WORTHY_PATTERN =
  /\b(amphitheater|arena|stadium|botanical|zoo|aquarium|state park|national park|symphony|broadway|headliner)\b/i;

const OUTDOOR_EVENT_PATTERN =
  /\b(festival|farmers market|outdoor|concert|marathon|race|parade|fair|market|5k|10k|park|garden tour|food truck|block party|street fair|amphitheater|tailgate|soccer|baseball)\b/i;

const OFFICIAL_SOURCE_PATTERN =
  /\b(ticketmaster|eventbrite|axs|dice\.fm|city of|county|library|museum|botanical|university|college|\.gov|\.edu)\b/i;

function isOutdoorEvent(event: LocalEvent): boolean {
  if (event.category === "market" || event.category === "sports") return true;
  const hay = `${event.name} ${event.venue} ${event.category ?? ""}`;
  return OUTDOOR_EVENT_PATTERN.test(hay);
}

/** Higher when date/time are specific and soon — never invent missing dates. */
export function timelinessScore(startDateTime: string, now: Date): number {
  const raw = startDateTime.trim().toLowerCase();
  if (!raw || raw === "time tba" || raw === "date tba") return -4;

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = dayNames[now.getDay()];
  if (/\btoday\b/.test(raw)) return 22;
  if (/\btomorrow\b/.test(raw)) return 18;
  if (raw.includes(today)) return 14;

  if (/\b\d{1,2}(:\d{2})?\s*[ap]m\b/.test(raw)) return 8;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(raw)) {
    return 6;
  }
  if (/\bthis week\b|\bweekend\b/.test(raw)) return 4;
  return 0;
}

function completenessScore(event: LocalEvent): number {
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
  if (OFFICIAL_SOURCE_PATTERN.test(`${event.sourceUrl} ${event.sourceName}`)) {
    score += 6;
  }
  if (event.banditNote?.trim()) score += 3;
  if (event.imageUrl?.trim()) score += 3;
  if (event.sourceTier === "official") score += 8;
  else if (event.sourceTier === "venue") score += 4;
  else score += trustScoreForSource(event.sourceId) >= 90 ? 6 : 0;
  return score;
}

function discoveryEditorialAdjustments(event: LocalEvent): number {
  let score = 0;
  const hay = venueHayFromParts([event.name, event.venue, event.category, event.sourceName]);

  if (SEASONAL_PATTERN.test(hay)) score += 6;
  if (UNIQUE_PATTERN.test(hay)) score += 5;
  if (event.category === "family") score += 5;
  if (event.badges?.includes("free")) score += 6;
  if (COMMUNITY_PATTERN.test(hay)) score += 4;
  if (RECURRING_FAVORITE_PATTERN.test(hay)) score += 3;
  if (EDUCATIONAL_PATTERN.test(hay)) score += 4;
  if (DRIVE_WORTHY_PATTERN.test(hay)) score += 4;
  if (/\b(concert|market|food truck|art walk|block party)\b/i.test(hay)) score += 3;

  // Popularity alone should not dominate — slight penalty for generic aggregators
  // with thin detail when an official source would read better.
  if (
    event.sourceTier === "aggregator" &&
    isGenericEventTitle(event.name) &&
    !(event.imageUrl?.trim())
  ) {
    score -= 4;
  }

  return score;
}

function editorialQualityAdjustments(event: LocalEvent): number {
  let score = 0;
  if (isGenericEventTitle(event.name)) score -= 12;
  const venue = event.venue?.trim().toLowerCase() ?? "";
  if (!venue || venue === "venue tba") score -= 10;
  const schedule = event.startDateTime.trim().toLowerCase();
  if (
    schedule === "time tba" ||
    schedule === "date tba" ||
    schedule === "date tba time tba"
  ) {
    score -= 8;
  }
  const hay = venueHayFromParts([event.name, event.venue, event.category]);
  if (/\b(ticket|tickets|admission|register|rsvp)\b/i.test(`${event.sourceUrl} ${event.name}`)) {
    score += 4;
  }
  if (/\b(farmers market|food truck|block party|street fair|parade|festival)\b/i.test(hay)) {
    score += 4;
  }
  return score;
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

export function scoreLocalEventForEdition(
  event: LocalEvent,
  options?: { now?: Date; weatherIntel?: WeatherIntelligence | null }
): number {
  const now = options?.now ?? new Date();
  return (
    timelinessScore(event.startDateTime, now) +
    completenessScore(event) +
    editorialQualityAdjustments(event) +
    discoveryEditorialAdjustments(event) +
    weatherAdjustment(event, options?.weatherIntel)
  );
}

/** Rank events for today's edition — timeliness and verified facts before photos alone. */
export function rankLocalEventsForEdition(
  events: LocalEvent[],
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
  }
): LocalEvent[] {
  return [...events]
    .map((event) => ({
      event,
      score: scoreLocalEventForEdition(event, options),
    }))
    .filter((row) => row.score >= LOCAL_EVENT_PUBLISH_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.event);
}

export { LOCAL_EVENT_PUBLISH_MIN_SCORE };
