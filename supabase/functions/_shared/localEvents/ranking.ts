/**
 * Editorial ranking for Local Events — confirmed facts first, then
 * timeliness, then weather suitability for outdoor listings.
 * Images influence tie-breaks only; they never fabricate event facts.
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../editorial/publishing.ts";
import type { LocalEvent } from "./provider.ts";

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
  if (event.sourceUrl?.trim()) score += 5;
  if (event.venue?.trim()) score += 3;
  if (event.city?.trim()) score += 2;
  if (
    event.startDateTime.trim() &&
    event.startDateTime !== "Time TBA" &&
    event.startDateTime !== "Date TBA"
  ) {
    score += 4;
  }
  if (OFFICIAL_SOURCE_PATTERN.test(`${event.sourceUrl} ${event.sourceName}`)) {
    score += 3;
  }
  if (event.imageUrl?.trim()) score += 2;
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
