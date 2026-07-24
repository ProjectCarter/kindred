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
 * 5. Apply per-source image rights — strip unauthorized listing photography
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
import type { TicketmasterGatherDiagnostics } from "./sources/ticketmasterSearch.ts";
import {
  getLastTicketmasterConnection,
  isTicketmasterConfigured,
} from "./sources/ticketmasterSearch.ts";
import { mergeEventsFromSources } from "./merge.ts";
import { normalizeEvents } from "./normalize.ts";
import { applyEventImageRightsBatch } from "./sourceRights.ts";
import { rankLocalEventsForEdition } from "./ranking.ts";
import { attachEventHorizon } from "./horizon.ts";
import {
  filterVerifiedEventsForEdition,
  assertEventsVerifiedForPublication,
} from "./eventDateVerification.ts";
import {
  isEventbriteOnlyMode,
  qualifyEventbriteEvents,
} from "./eventbriteOnlyMode.ts";
import { filterFamilyFriendlyEvents } from "./familyFriendlyFilter.ts";
import { filterNonBusinessEvents } from "./businessEventFilter.ts";

export type LocalEventsPipelineMeta = {
  candidateCount: number;
  mergedCount: number;
  normalizedCount: number;
  imagesEnriched: number;
  imagesSuppressed: number;
  imagesDisplayAuthorized: number;
  discoveredInHorizon: number;
  scoredAboveThreshold: number;
  publishedCount: number;
  rejectedByDateVerification: number;
  dateVerificationRejections?: Array<{
    name: string;
    sourceUrl: string;
    reason: string;
  }>;
  sourcesUsed: LocalEventSourceId[];
  sourceCounts: Record<string, number>;
  eventsWithImages: number;
  editorNotes: string[];
  /** Validation — titles in the ranked pool in editorial order. */
  rankedPoolTitles?: string[];
  /** TEMPORARY — Eventbrite-only test diagnostics. */
  eventbriteOnly?: import("./eventbriteOnlyMode.ts").EventbriteQualificationReport;
  /** Ticketmaster Discovery API diagnostics for edition build logs. */
  ticketmaster?: TicketmasterGatherDiagnostics;
  /** Candidates removed during cross-source dedupe. */
  duplicatesRemoved?: number;
  /** Adult entertainment listings removed before dedupe and ranking. */
  familyFilteredCount?: number;
  familyFilterSamples?: Array<{
    name: string;
    signal: string;
    category: import("./familyFriendlyFilter.ts").EditorialExclusionCategory;
  }>;
  /** Business / professional-development listings removed before dedupe and ranking. */
  businessFilteredCount?: number;
  businessFilterSamples?: Array<{ name: string; signal: string }>;
};

export type LocalEventsPipelineOptions = LocalEventsFetchOptions & {
  now?: Date;
  weatherIntel?: WeatherIntelligence | null;
};

export async function runLocalEventsPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<{ events: LocalEvent[]; meta: LocalEventsPipelineMeta }> {
  const eventbriteOnly = options?.eventbriteOnly ?? isEventbriteOnlyMode();
  if (eventbriteOnly) {
    return runEventbriteOnlyPipeline(location, options);
  }

  const editorNotes: string[] = [];
  const sourceCounts: Record<string, number> = {};
  let familyFilteredCount = 0;
  const familyFilterSamples: LocalEventsPipelineMeta["familyFilterSamples"] = [];
  let businessFilteredCount = 0;
  const businessFilterSamples: LocalEventsPipelineMeta["businessFilterSamples"] =
    [];

  // 1. Gather
  const gatherResults = await gatherFromAllSources(location, options);
  const sourceBatches: LocalEvent[][] = [];
  for (const result of gatherResults) {
    if (result.events.length) {
      const familyFiltered = filterFamilyFriendlyEvents(result.events);
      familyFilteredCount += familyFiltered.filteredCount;
      for (const sample of familyFiltered.samples) {
        if (familyFilterSamples.length < 8) {
          familyFilterSamples.push(sample);
        }
      }
      // Business / professional-development exclusion — Local Events only.
      const businessFiltered = filterNonBusinessEvents(familyFiltered.kept);
      businessFilteredCount += businessFiltered.filteredCount;
      for (const sample of businessFiltered.samples) {
        if (businessFilterSamples.length < 8) {
          businessFilterSamples.push(sample);
        }
      }
      if (businessFiltered.kept.length) {
        sourceCounts[result.sourceId] = businessFiltered.kept.length;
        sourceBatches.push(businessFiltered.kept);
      }
    }
    if (result.error) {
      editorNotes.push(`${result.sourceId} gather failed — continuing.`);
    }
  }

  if (familyFilteredCount > 0) {
    console.log("[localEvents:editorialFilter] removed excluded listings", {
      filteredCount: familyFilteredCount,
      samples: familyFilterSamples,
    });
    editorNotes.push(
      `Editorial exclusion filter removed ${familyFilteredCount} listing(s) before ranking.`
    );
  }

  if (businessFilteredCount > 0) {
    console.log("[localEvents:businessFilter] removed business/professional listings", {
      filteredCount: businessFilteredCount,
      samples: businessFilterSamples,
    });
    editorNotes.push(
      `Business/professional exclusion filter removed ${businessFilteredCount} listing(s) before ranking.`
    );
  }

  const candidateCount = sourceBatches.reduce((n, batch) => n + batch.length, 0);
  const ticketmasterRetrieved = sourceCounts.ticketmaster ?? 0;
  let ticketmasterDiagnostics: TicketmasterGatherDiagnostics | undefined;
  if (isTicketmasterConfigured()) {
    const connection = getLastTicketmasterConnection();
    ticketmasterDiagnostics = {
      connected: connection?.ok ?? false,
      connectionMessage: connection?.message ?? "Ticketmaster connection not probed",
      retrieved: ticketmasterRetrieved,
      rateLimited: connection?.rateLimited,
    };
  }

  // 2. Dedupe
  const merged = mergeEventsFromSources(sourceBatches);
  const duplicatesRemoved = Math.max(0, candidateCount - merged.length);

  // 3–4. Normalize (dates, URLs, provenance, official-source tier)
  const normalized = normalizeEvents(merged);

  const beforeRights = normalized.filter((e) => Boolean(e.imageUrl?.trim())).length;

  // 5. Source image-rights — never display unlicensed listing photography
  const withRights = applyEventImageRightsBatch(normalized);
  const imagesDisplayAuthorized = withRights.filter((e) =>
    Boolean(e.imageUrl?.trim())
  ).length;
  const imagesSuppressed = Math.max(0, beforeRights - imagesDisplayAuthorized);

  // 8. Strict date verification — reject past, ambiguous, or unverified schedules.
  const now = options?.now ?? new Date();
  const inHorizon = withRights
    .slice(0, SERPAPI_CANDIDATE_CAP)
    .map((event) => attachEventHorizon(event, now))
    .filter((event) => event.horizonBucket !== "beyond");

  const dateVerified = filterVerifiedEventsForEdition(inHorizon, {
    now,
    location,
    eventTimezone: options?.timezone,
    editionDate: options?.editionDate,
  });

  const ranked = rankLocalEventsForEdition(dateVerified.verified, {
    now,
    weatherIntel: options?.weatherIntel,
    readerCity: location.city,
    readerLat: location.lat,
    readerLon: location.lon,
  });

  const sourcesUsed = gatherResults
    .filter((r) => r.events.length > 0)
    .map((r) => r.sourceId);

  if (sourceCounts.nps_park_events) {
    editorNotes.push(
      `National Park Service contributed ${sourceCounts.nps_park_events} official program(s).`
    );
  }
  if (imagesSuppressed > 0) {
    editorNotes.push(
      `Withheld ${imagesSuppressed} listing photograph(s) pending source image authorization.`
    );
  }
  if (imagesDisplayAuthorized > 0) {
    editorNotes.push(
      `${imagesDisplayAuthorized} listing(s) carry authorized photography.`
    );
  }
  if (ticketmasterDiagnostics) {
    editorNotes.push(
      `Ticketmaster returned ${ticketmasterDiagnostics.retrieved} listing(s)` +
        (ticketmasterDiagnostics.connected ? " (connected)." : ` (${ticketmasterDiagnostics.connectionMessage}).`)
    );
    console.log("[localEvents:ticketmaster] summary", {
      connectionStatus: ticketmasterDiagnostics.connected
        ? "connected"
        : "failed",
      eventsRetrieved: ticketmasterDiagnostics.retrieved,
      mergedTotal: merged.length,
      duplicatesRemoved,
      message: ticketmasterDiagnostics.connectionMessage,
      rateLimited: ticketmasterDiagnostics.rateLimited ?? false,
    });
  }
  editorNotes.push(
    `Gathered ${candidateCount} candidates from ${sourcesUsed.length} source(s); ` +
      `${familyFilteredCount} removed by editorial exclusion filter; ` +
      `${businessFilteredCount} removed by business/professional filter; ` +
      `${merged.length} after dedupe; ${inHorizon.length} within 30 days; ` +
      `${dateVerified.rejected.length} rejected by date verification; ` +
      `${ranked.length} scored above threshold; ${ranked.length} persisted.`
  );

  const meta: LocalEventsPipelineMeta = {
    candidateCount,
    mergedCount: merged.length,
    normalizedCount: normalized.length,
    imagesEnriched: 0,
    imagesSuppressed,
    imagesDisplayAuthorized,
    discoveredInHorizon: inHorizon.length,
    rejectedByDateVerification: dateVerified.rejected.length,
    dateVerificationRejections: dateVerified.rejected.slice(0, 12).map((row) => ({
      name: row.name,
      sourceUrl: row.sourceUrl,
      reason: row.reason,
    })),
    scoredAboveThreshold: ranked.length,
    publishedCount: ranked.length,
    sourcesUsed,
    sourceCounts,
    eventsWithImages: imagesDisplayAuthorized,
    rankedPoolTitles: ranked.map((e) => e.name),
    editorNotes,
    ticketmaster: ticketmasterDiagnostics,
    duplicatesRemoved,
    familyFilteredCount,
    familyFilterSamples:
      familyFilterSamples.length > 0 ? familyFilterSamples : undefined,
    businessFilteredCount,
    businessFilterSamples:
      businessFilterSamples.length > 0 ? businessFilterSamples : undefined,
  };

  console.log("[localEvents:pipeline] complete", meta);

  return { events: ranked, meta };
}

/** TEMPORARY — Eventbrite-only test path through the real production pipeline. */
async function runEventbriteOnlyPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<{ events: LocalEvent[]; meta: LocalEventsPipelineMeta }> {
  const now = options?.now ?? new Date();
  const editorNotes = [
    "EVENTBRITE_ONLY test mode — all other Local Events sources disabled.",
  ];

  const gatherResults = await gatherFromAllSources(location, {
    ...options,
    eventbriteOnly: true,
  });

  const raw = gatherResults.flatMap((r) => r.events);
  const familyFiltered = filterFamilyFriendlyEvents(raw);
  const businessFiltered = filterNonBusinessEvents(familyFiltered.kept);
  const sourceCounts: Record<string, number> = {};
  for (const result of gatherResults) {
    if (result.events.length) {
      sourceCounts[result.sourceId] = result.events.length;
    }
  }

  if (familyFiltered.filteredCount > 0) {
    console.log("[localEvents:editorialFilter] eventbriteOnly removed listings", {
      filteredCount: familyFiltered.filteredCount,
      samples: familyFiltered.samples,
    });
    editorNotes.push(
      `Editorial exclusion filter removed ${familyFiltered.filteredCount} listing(s).`
    );
  }

  if (businessFiltered.filteredCount > 0) {
    console.log("[localEvents:businessFilter] eventbriteOnly removed listings", {
      filteredCount: businessFiltered.filteredCount,
      samples: businessFiltered.samples,
    });
    editorNotes.push(
      `Business/professional exclusion filter removed ${businessFiltered.filteredCount} listing(s).`
    );
  }

  console.log("[localEvents:eventbriteOnly] gathered", {
    totalReturned: raw.length,
    afterFamilyFilter: familyFiltered.kept.length,
    afterBusinessFilter: businessFiltered.kept.length,
    sources: Object.keys(sourceCounts),
  });

  const normalized = normalizeEvents(businessFiltered.kept);
  const beforeRights = normalized.filter((e) => Boolean(e.imageUrl?.trim())).length;
  const withRights = applyEventImageRightsBatch(normalized);
  const imagesDisplayAuthorized = withRights.filter((e) =>
    Boolean(e.imageUrl?.trim())
  ).length;
  const imagesSuppressed = Math.max(0, beforeRights - imagesDisplayAuthorized);
  const { qualified, report } = qualifyEventbriteEvents(withRights, location, now);
  const dateVerified = filterVerifiedEventsForEdition(qualified, {
    now,
    location,
    eventTimezone: options?.timezone,
    editionDate: options?.editionDate,
  });
  const verified = dateVerified.verified;

  editorNotes.push(
    `Eventbrite returned ${report.totalReturned}; ` +
      `${report.rejectedDate} rejected for date; ` +
      `${report.rejectedDistance} rejected for distance; ` +
      `${report.rejectedMissing} rejected for missing data; ` +
      `${dateVerified.rejected.length} rejected by date verification; ` +
      `${verified.length} persisted.`
  );

  const meta: LocalEventsPipelineMeta = {
    candidateCount: raw.length,
    mergedCount: normalized.length,
    normalizedCount: normalized.length,
    imagesEnriched: 0,
    imagesSuppressed,
    imagesDisplayAuthorized,
    discoveredInHorizon: qualified.length,
    rejectedByDateVerification: dateVerified.rejected.length,
    dateVerificationRejections: dateVerified.rejected.slice(0, 12).map((row) => ({
      name: row.name,
      sourceUrl: row.sourceUrl,
      reason: row.reason,
    })),
    scoredAboveThreshold: verified.length,
    publishedCount: verified.length,
    sourcesUsed: ["eventbrite"],
    sourceCounts,
    eventsWithImages: imagesDisplayAuthorized,
    rankedPoolTitles: verified.map((e) => e.name),
    editorNotes,
    eventbriteOnly: report,
    familyFilteredCount: familyFiltered.filteredCount,
    familyFilterSamples:
      familyFiltered.samples.length > 0 ? familyFiltered.samples : undefined,
    businessFilteredCount: businessFiltered.filteredCount,
    businessFilterSamples:
      businessFiltered.samples.length > 0 ? businessFiltered.samples : undefined,
  };

  console.log("[localEvents:eventbriteOnly] complete", meta);

  return { events: verified, meta };
}

/** Backward-compatible entry — returns the full ranked qualified pool. */
export async function getLocalEventsFromPipeline(
  location: LocalEventLocation,
  options?: LocalEventsPipelineOptions
): Promise<LocalEvent[]> {
  const { events } = await runLocalEventsPipeline(location, options);
  return events;
}
