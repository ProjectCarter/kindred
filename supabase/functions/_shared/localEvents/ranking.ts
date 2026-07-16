/**
 * Editorial ranking for Local Events — uses Kindred Editorial Score.
 * Discovery is comprehensive; publication is editorial.
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../editorial/publishing.ts";
import {
  computeEventConfidence,
  shouldPublishEditorialConfidence,
} from "../editorial/confidence.ts";
import type { LocalEvent } from "./provider.ts";
import {
  computeKindredEventEditorialScore,
  type KindredEventEditorialScore,
} from "./editorialScore.ts";
import type { EventHorizonBucket } from "./horizon.ts";
import { isEventDateVerified } from "./eventDateVerification.ts";

export {
  computeKindredEventEditorialScore,
  scalarEventEditorialScore,
  type KindredEventEditorialScore,
  type KindredEventEditorialDimensions,
  type KindredEventScoreReason,
} from "./editorialScore.ts";

/** @deprecated Use computeKindredEventEditorialScore — kept for callers expecting a scalar. */
export function timelinessScore(
  startDateTime: string,
  now: Date,
  options?: {
    startDateIso?: string | null;
    horizonBucket?: EventHorizonBucket | null;
  }
): number {
  const stub: LocalEvent = {
    name: "stub",
    startDateTime,
    startDateIso: options?.startDateIso,
    horizonBucket: options?.horizonBucket,
    venue: "Venue",
    city: "City",
    sourceUrl: "https://example.com",
    sourceName: "Stub",
  };
  return computeKindredEventEditorialScore(stub, {
    now,
    horizonBucket: options?.horizonBucket,
  }).dimensions.timeliness;
}

export function scoreLocalEventForEdition(
  event: LocalEvent,
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
    horizonBucket?: EventHorizonBucket | null;
    readerCity?: string | null;
  }
): number {
  return computeKindredEventEditorialScore(event, options).total;
}

export function scoreLocalEventWithBreakdown(
  event: LocalEvent,
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
    horizonBucket?: EventHorizonBucket | null;
    readerCity?: string | null;
  }
): { event: LocalEvent; score: KindredEventEditorialScore } {
  const score = computeKindredEventEditorialScore(event, options);
  return {
    event: { ...event, editorialScore: score },
    score,
  };
}

/** Rank discovered events — editorial score + confidence gate, highest first. */
export function rankLocalEventsForEdition(
  events: LocalEvent[],
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
    readerCity?: string | null;
  }
): LocalEvent[] {
  return [...events]
    .map((event) =>
      scoreLocalEventWithBreakdown(event, {
        now: options?.now,
        weatherIntel: options?.weatherIntel,
        horizonBucket: event.horizonBucket,
        readerCity: options?.readerCity ?? event.city,
      })
    )
    .filter(
      (row) =>
        isEventDateVerified(row.event) &&
        row.score.total >= LOCAL_EVENT_PUBLISH_MIN_SCORE &&
        shouldPublishEditorialConfidence(computeEventConfidence(row.event))
    )
    .sort((a, b) => b.score.total - a.score.total)
    .map((row) => row.event);
}

export { LOCAL_EVENT_PUBLISH_MIN_SCORE };
