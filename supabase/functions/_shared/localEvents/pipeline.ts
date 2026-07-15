/**
 * Local Events editorial pipeline — gather, dedupe, normalize, rank, publish.
 *
 * Every edition build and live refresh runs this pipeline so Kindred discovers
 * the best events before anyone else — calm newspaper curation, not a directory dump.
 *
 * Nightly stages:
 * 1. Gather from trusted sources
 * 2. Remove duplicates
 * 3. Normalize dates, times, prices, locations, provenance
 * 4. Prefer official listing URLs (via normalize + merge priority)
 * 5. Enrich authentic event images when providers omit photography
 * 6. Editorial summaries — Bandit notes at edition build (banditNotes.ts)
 * 7. Badges — resolved at parse time (badgeResolver.ts)
 * 8. Rank by editorial quality — persist the full qualified pool in edition order
 * 9. Homepage rendering caps first paint; the stored edition retains every pick
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { SERPAPI_CANDIDATE_CAP } from "../editorial/publishing.ts";
import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "./provider.ts";
import { gatherFromAllSources } from "./sources/registry.ts";
import type { LocalEventSourceId } from "./sources/types.ts";
import { mergeEventsFromSources } from "./merge.ts";
import { normalizeEvents } from "./normalize.ts";
import { enrichEventImages } from "./enrichImages.ts";
import { rankLocalEventsForEdition } from "./ranking.ts";
import { attachEventHorizon } from "./horizon.ts";

export type LocalEventsPipelineMeta = {
  candidateCount: number;
  mergedCount: number;
  normalizedCount: number;
  imagesEnriched: number;
  discoveredInHorizon: number;
  scoredAboveThreshold: number;
  publishedCount: number;
  sourcesUsed: LocalEventSourceId[];
  sourceCounts: Record<string, number>;
  eventsWithImages: number;
  editorNotes: string[];
  /** Validation — titles in the ranked pool in editorial order. */
  rankedPoolTitles?: string[];
};

export type LocalEventsPipelineOptions = LocalEventsFetchOptions & {
  now?: Date;
  weatherIntel?: WeatherIntelligence | null;
};

export async function runLocalEventsPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<{ events: LocalEvent[]; meta: LocalEventsPipelineMeta }> {
  const editorNotes: string[] = [];
  const sourceCounts: Record<string, number> = {};

  // 1. Gather
  const gatherResults = await gatherFromAllSources(location, options);
  const sourceBatches: LocalEvent[][] = [];
  for (const result of gatherResults) {
    if (result.events.length) {
      sourceCounts[result.sourceId] = result.events.length;
      sourceBatches.push(result.events);
    }
    if (result.error) {
      editorNotes.push(`${result.sourceId} gather failed — continuing.`);
    }
  }

  const candidateCount = sourceBatches.reduce((n, batch) => n + batch.length, 0);

  // 2. Dedupe
  const merged = mergeEventsFromSources(sourceBatches);

  // 3–4. Normalize (dates, URLs, provenance, official-source tier)
  const normalized = normalizeEvents(merged);

  const beforeImages = normalized.filter((e) => Boolean(e.imageUrl?.trim())).length;

  // 5. Authentic image enrichment
  const withImages = await enrichEventImages(normalized);
  const imagesEnriched = withImages.filter((e) => Boolean(e.imageUrl?.trim())).length - beforeImages;

  // 8. Rank within 30-day horizon — persist the full qualified pool in order.
  const now = options?.now ?? new Date();
  const inHorizon = withImages
    .slice(0, SERPAPI_CANDIDATE_CAP)
    .map((event) => attachEventHorizon(event, now))
    .filter((event) => event.horizonBucket !== "beyond");

  const ranked = rankLocalEventsForEdition(inHorizon, {
    now,
    weatherIntel: options?.weatherIntel,
    readerCity: location.city,
  });

  const sourcesUsed = gatherResults
    .filter((r) => r.events.length > 0)
    .map((r) => r.sourceId);

  if (sourceCounts.nps_park_events) {
    editorNotes.push(
      `National Park Service contributed ${sourceCounts.nps_park_events} official program(s).`
    );
  }
  if (imagesEnriched > 0) {
    editorNotes.push(`Enriched ${imagesEnriched} listing(s) with authentic venue photography.`);
  }
  editorNotes.push(
    `Gathered ${candidateCount} candidates from ${sourcesUsed.length} source(s); ` +
      `${merged.length} after dedupe; ${inHorizon.length} within 30 days; ` +
      `${ranked.length} scored above threshold; ${ranked.length} persisted.`
  );

  const meta: LocalEventsPipelineMeta = {
    candidateCount,
    mergedCount: merged.length,
    normalizedCount: normalized.length,
    imagesEnriched: Math.max(0, imagesEnriched),
    discoveredInHorizon: inHorizon.length,
    scoredAboveThreshold: ranked.length,
    publishedCount: ranked.length,
    sourcesUsed,
    sourceCounts,
    eventsWithImages: ranked.filter((e) => Boolean(e.imageUrl?.trim())).length,
    rankedPoolTitles: ranked.map((e) => e.name),
    editorNotes,
  };

  console.log("[localEvents:pipeline] complete", meta);

  return { events: ranked, meta };
}

/** Backward-compatible entry — returns the full ranked qualified pool. */
export async function getLocalEventsFromPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<LocalEvent[]> {
  const { events } = await runLocalEventsPipeline(location, options);
  return events;
}
