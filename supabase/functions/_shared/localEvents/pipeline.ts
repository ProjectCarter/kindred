/**
 * Local Events editorial pipeline — gather, dedupe, normalize, rank, publish.
 *
 * Every edition build and live refresh runs this pipeline so Kindred discovers
 * the best events before anyone else — calm newspaper curation, not a directory dump.
 */

import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { SERPAPI_CANDIDATE_CAP } from "../editorial/publishing.ts";
import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "./provider.ts";
import { fetchSerpGoogleEventCandidates } from "./provider.ts";
import { fetchNpsParkEvents } from "./sources/npsParkEvents.ts";
import type { LocalEventSourceId } from "./sources/types.ts";
import { mergeEventsFromSources } from "./merge.ts";
import { normalizeEvents } from "./normalize.ts";
import { rankLocalEventsForEdition } from "./ranking.ts";

export type LocalEventsPipelineMeta = {
  candidateCount: number;
  mergedCount: number;
  publishedCount: number;
  sourcesUsed: LocalEventSourceId[];
  sourceCounts: Record<string, number>;
  eventsWithImages: number;
  editorNotes: string[];
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

  const [serp, nps] = await Promise.all([
    fetchSerpGoogleEventCandidates(location, options).catch((err) => {
      console.warn("[localEvents:pipeline] serp gather failed", err);
      editorNotes.push("Google Events gather failed — continuing with other sources.");
      return [] as LocalEvent[];
    }),
    fetchNpsParkEvents(location).catch((err) => {
      console.warn("[localEvents:pipeline] nps gather failed", err);
      return [] as LocalEvent[];
    }),
  ]);

  if (serp.length) sourceCounts.serp_google_events = serp.length;
  if (nps.length) sourceCounts.nps_park_events = nps.length;

  const candidateCount = serp.length + nps.length;
  const merged = mergeEventsFromSources([serp, nps]);
  const normalized = normalizeEvents(merged);
  const ranked = rankLocalEventsForEdition(
    normalized.slice(0, SERPAPI_CANDIDATE_CAP),
    { now: options?.now, weatherIntel: options?.weatherIntel }
  );

  const sourcesUsed = [
    ...(serp.length ? (["serp_google_events"] as const) : []),
    ...(nps.length ? (["nps_park_events"] as const) : []),
  ];

  if (nps.length) {
    editorNotes.push(`National Park Service contributed ${nps.length} official program(s).`);
  }
  editorNotes.push(
    `Gathered ${candidateCount} candidates from ${sourcesUsed.length || 0} source(s); ` +
      `${merged.length} after dedupe; ${ranked.length} published.`
  );

  const meta: LocalEventsPipelineMeta = {
    candidateCount,
    mergedCount: merged.length,
    publishedCount: ranked.length,
    sourcesUsed: [...sourcesUsed],
    sourceCounts,
    eventsWithImages: ranked.filter((e) => Boolean(e.imageUrl?.trim())).length,
    editorNotes,
  };

  console.log("[localEvents:pipeline] complete", meta);

  return { events: ranked, meta };
}

/** Backward-compatible entry — returns published events only. */
export async function getLocalEventsFromPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<LocalEvent[]> {
  const { events } = await runLocalEventsPipeline(location, options);
  return events;
}
