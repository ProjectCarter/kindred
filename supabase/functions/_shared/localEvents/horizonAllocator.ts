/**
 * Balanced Local Events mix — Today, This Weekend, Next Weekend, Coming Soon.
 * Quality and variety within each bucket; never fill with far-future filler.
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import {
  computeEventConfidence,
  shouldPublishEditorialConfidence,
} from "../editorial/confidence.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../editorial/publishing.ts";
import type { LocalEvent } from "./provider.ts";
import {
  type EventHorizonBucket,
  attachEventHorizon,
  isWithinEventHorizon,
} from "./horizon.ts";
import { scoreLocalEventForEdition } from "./ranking.ts";

const MAX_PER_CATEGORY = 2;

/** Target editorial mix per bucket for a full edition spread. */
const BUCKET_TARGETS: Record<Exclude<EventHorizonBucket, "beyond">, number> = {
  today: 2,
  this_weekend: 2,
  next_weekend: 2,
  coming_soon: 4,
};

const BUCKET_ORDER: Array<Exclude<EventHorizonBucket, "beyond">> = [
  "today",
  "this_weekend",
  "next_weekend",
  "coming_soon",
];

type ScoredEvent = {
  event: LocalEvent;
  score: number;
  bucket: EventHorizonBucket;
};

function scoreAndBucket(
  events: LocalEvent[],
  options?: { now?: Date; weatherIntel?: WeatherIntelligence | null; readerCity?: string | null }
): ScoredEvent[] {
  const now = options?.now ?? new Date();
  return events
    .map((raw) => {
      const event = attachEventHorizon(raw, now);
      const bucket = event.horizonBucket ?? "coming_soon";
      return {
        event,
        bucket,
        score: scoreLocalEventForEdition(event, {
          now,
          weatherIntel: options?.weatherIntel,
          horizonBucket: bucket,
          readerCity: options?.readerCity ?? event.city,
        }),
      };
    })
    .filter(
      (row) =>
        row.bucket !== "beyond" &&
        isWithinEventHorizon(row.event, now) &&
        row.score >= LOCAL_EVENT_PUBLISH_MIN_SCORE &&
        shouldPublishEditorialConfidence(computeEventConfidence(row.event))
    );
}

export function allocateLocalEventsByHorizon(
  events: LocalEvent[],
  options?: {
    now?: Date;
    weatherIntel?: WeatherIntelligence | null;
    maxTotal?: number;
    readerCity?: string | null;
  }
): LocalEvent[] {
  const maxTotal = options?.maxTotal ?? Number.POSITIVE_INFINITY;
  const scored = scoreAndBucket(events, options).sort((a, b) => b.score - a.score);

  const byBucket = new Map<EventHorizonBucket, ScoredEvent[]>();
  for (const row of scored) {
    const list = byBucket.get(row.bucket) ?? [];
    list.push(row);
    byBucket.set(row.bucket, list);
  }

  const categoryCounts = new Map<string, number>();
  const picked: LocalEvent[] = [];
  const pickedIds = new Set<string>();

  function tryPick(row: ScoredEvent): boolean {
    if (picked.length >= maxTotal) return false;
    const key = `${row.event.name}|${row.event.startDateTime}`.toLowerCase();
    if (pickedIds.has(key)) return false;
    const category = row.event.category ?? "community";
    const used = categoryCounts.get(category) ?? 0;
    if (used >= MAX_PER_CATEGORY) return false;
    categoryCounts.set(category, used + 1);
    pickedIds.add(key);
    picked.push(row.event);
    return true;
  }

  // First pass — hit editorial bucket targets.
  for (const bucket of BUCKET_ORDER) {
    const target = BUCKET_TARGETS[bucket];
    const pool = byBucket.get(bucket) ?? [];
    let added = 0;
    for (const row of pool) {
      if (added >= target) break;
      if (tryPick(row)) added += 1;
    }
  }

  // Second pass — fill remaining slots with best editorial scores, any bucket.
  for (const row of scored) {
    if (picked.length >= maxTotal) break;
    tryPick(row);
  }

  return picked;
}
