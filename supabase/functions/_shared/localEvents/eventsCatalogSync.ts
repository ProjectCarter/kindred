/**
 * Events catalog sync — scheduled provider ingestion + edition read path.
 * Server-side only; never called from client or per-user edition reads.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  createBudgetTracker,
  estimateProviderCallCost,
  isProviderDisabled,
  loadCatalogSyncBudget,
  nextScheduledRunAt,
  recordApiCalls,
  type CatalogSyncMode,
} from "../editorial/catalogSyncBudget.ts";
import { SERPAPI_CANDIDATE_CAP, EDITION_EVENTS_CATALOG_READ_LIMIT } from "../editorial/publishing.ts";
import { mergeEventsFromSources } from "./merge.ts";
import { normalizeEvents } from "./normalize.ts";
import { applyEventImageRightsBatch } from "./sourceRights.ts";
import { attachEventHorizon } from "./horizon.ts";
import { filterVerifiedEventsForEdition } from "./eventDateVerification.ts";
import { filterFamilyFriendlyEvents } from "./familyFriendlyFilter.ts";
import { gatherFromAllSources } from "./sources/registry.ts";
import { rankLocalEventsForEdition } from "./ranking.ts";
import { resolveEventTimezone } from "./eventTimezone.ts";
import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "./provider.ts";
import {
  eventContentFingerprint,
  eventDedupeKey,
  eventVerificationConfidence,
  extractEventProviderId,
  findEventCatalogDuplicate,
  isEventCatalogActiveLifecycle,
  metroKeyFromEventLocation,
  resolveEventCatalogLifecycle,
  rowToLocalEvent,
  serializeEventPayload,
  type EventsCatalogRow,
} from "./eventsCatalog.ts";

export type EventsMetroRow = {
  metro_key: string;
  city: string;
  region: string | null;
  state: string | null;
  lat: number;
  lon: number;
  initial_import_completed_at: string | null;
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
};

export type EventsSyncRunStats = {
  metroKey: string;
  mode: CatalogSyncMode;
  apiCalls: number;
  rawRecordsReturned: number;
  existingSkipped: number;
  newDiscovered: number;
  changedUpdated: number;
  duplicatesMerged: number;
  recordsRejected: number;
  articlesQueued: number;
  estimatedCostUsd: number;
  expiredPast: number;
  archivedMissing: number;
};

export { metroKeyFromEventLocation };

export async function registerEventsMetro(
  admin: SupabaseClient,
  location: LocalEventLocation
): Promise<void> {
  const metroKey = metroKeyFromEventLocation(location);
  await admin.from("events_catalog_metros").upsert(
    {
      metro_key: metroKey,
      city: location.city,
      region: location.region ?? null,
      state: location.state ?? null,
      lat: location.lat,
      lon: location.lon,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "metro_key" }
  );
}

async function prepareVerifiedCatalogEvents(
  location: LocalEventLocation,
  options: {
    now: Date;
    editionDate?: string;
    timezone?: string;
    budgetTracker: ReturnType<typeof createBudgetTracker>;
  }
): Promise<{ events: LocalEvent[]; rawCount: number; apiCalls: number }> {
  const budget = loadCatalogSyncBudget();
  const gatherResults = await gatherFromAllSources(location, {
    now: options.now,
    editionDate: options.editionDate,
    timezone: options.timezone,
  });

  let apiCalls = 0;
  let rawCount = 0;
  const sourceBatches: LocalEvent[][] = [];

  for (const result of gatherResults) {
    if (isProviderDisabled(result.sourceId)) continue;
    apiCalls += 1;
    recordApiCalls(options.budgetTracker, budget, 1, `${result.sourceId} gather`);
    if (options.budgetTracker.aborted) break;

    rawCount += result.events.length;
    if (!result.events.length) continue;

    const familyFiltered = filterFamilyFriendlyEvents(result.events);
    if (familyFiltered.kept.length) {
      sourceBatches.push(familyFiltered.kept);
    }
  }

  const merged = mergeEventsFromSources(sourceBatches);
  const normalized = normalizeEvents(merged);
  const withRights = applyEventImageRightsBatch(normalized);

  const inHorizon = withRights
    .slice(0, SERPAPI_CANDIDATE_CAP)
    .map((event) => attachEventHorizon(event, options.now))
    .filter((event) => event.horizonBucket !== "beyond");

  const dateVerified = filterVerifiedEventsForEdition(inHorizon, {
    now: options.now,
    location,
    eventTimezone: options.timezone,
    editionDate: options.editionDate,
  });

  return {
    events: dateVerified.verified,
    rawCount,
    apiCalls,
  };
}

export async function syncEventsCatalogForMetro(
  admin: SupabaseClient,
  metro: EventsMetroRow,
  mode: CatalogSyncMode
): Promise<EventsSyncRunStats> {
  const started = Date.now();
  const now = new Date();
  const nowIso = now.toISOString();
  const budgetTracker = createBudgetTracker();

  const stats: EventsSyncRunStats = {
    metroKey: metro.metro_key,
    mode,
    apiCalls: 0,
    rawRecordsReturned: 0,
    existingSkipped: 0,
    newDiscovered: 0,
    changedUpdated: 0,
    duplicatesMerged: 0,
    recordsRejected: 0,
    articlesQueued: 0,
    estimatedCostUsd: 0,
    expiredPast: 0,
    archivedMissing: 0,
  };

  const { data: runRow } = await admin
    .from("events_catalog_sync_runs")
    .insert({
      metro_key: metro.metro_key,
      mode,
      started_at: nowIso,
    })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;

  const location: LocalEventLocation = {
    lat: metro.lat,
    lon: metro.lon,
    city: metro.city,
    region: metro.region,
    state: metro.state,
  };

  const eventTimezone = resolveEventTimezone(location);

  const { data: existingRows } = await admin
    .from("events_catalog")
    .select("*")
    .eq("metro_key", metro.metro_key);

  const existing = (existingRows ?? []) as EventsCatalogRow[];
  const seenKeys = new Set<string>();

  try {
    const prepared = await prepareVerifiedCatalogEvents(location, {
      now,
      timezone: eventTimezone,
      budgetTracker,
    });

    stats.apiCalls = prepared.apiCalls;
    stats.rawRecordsReturned = prepared.rawCount;

    for (const event of prepared.events) {
      const dedupeKey = eventDedupeKey(event);
      seenKeys.add(dedupeKey);

      const provider = event.sourceId ?? "unknown";
      const providerId = extractEventProviderId(event);
      const fingerprint = eventContentFingerprint(event);
      const lifecycle = resolveEventCatalogLifecycle(event, location, now, true);
      const confidence = eventVerificationConfidence(event);

      if (lifecycle === "rejected") {
        stats.recordsRejected += 1;
        continue;
      }

      const duplicate = findEventCatalogDuplicate(event, existing);
      if (duplicate && duplicate.dedupe_key !== dedupeKey && duplicate.provider !== provider) {
        stats.duplicatesMerged += 1;
        await admin.from("events_catalog_provider_links").upsert(
          {
            event_id: duplicate.id,
            metro_key: metro.metro_key,
            provider,
            provider_id: providerId,
            last_seen_at: nowIso,
          },
          { onConflict: "metro_key,provider,provider_id" }
        );
        continue;
      }

      const payload = serializeEventPayload(event);
      const patch = {
        dedupe_key: dedupeKey,
        name: event.name,
        venue: event.venue,
        city: event.city,
        lat: event.lat ?? null,
        lon: event.lon ?? null,
        start_at: event.startDateIso ?? null,
        end_at: event.endDateIso ?? null,
        event_timezone: event.eventTimezone ?? eventTimezone,
        official_website: event.officialWebsite ?? null,
        ticket_url: event.sourceUrl ?? null,
        content_fingerprint: fingerprint,
        lifecycle,
        verification_status: "verified",
        verification_confidence: confidence,
        event_payload: payload,
        image_source: event.imageSource ?? null,
        image_license: event.imageRights?.authorized ? "provider_authorized" : null,
        last_verified_at: nowIso,
        updated_at: nowIso,
      };

      const prior = existing.find(
        (row) =>
          row.provider === provider && row.provider_id === providerId
      ) ?? duplicate;

      if (prior) {
        if (
          prior.content_fingerprint === fingerprint &&
          prior.lifecycle === lifecycle &&
          prior.event_payload?.banditNote === payload.banditNote
        ) {
          stats.existingSkipped += 1;
          await admin
            .from("events_catalog")
            .update({ last_verified_at: nowIso, updated_at: nowIso })
            .eq("id", prior.id);
          await admin.from("events_catalog_provider_links").upsert(
            {
              event_id: prior.id,
              metro_key: metro.metro_key,
              provider,
              provider_id: providerId,
              last_seen_at: nowIso,
            },
            { onConflict: "metro_key,provider,provider_id" }
          );
          continue;
        }

        stats.changedUpdated += 1;
        await admin
          .from("events_catalog")
          .update({
            ...patch,
            last_material_change_at: nowIso,
          })
          .eq("id", prior.id);
        await admin.from("events_catalog_provider_links").upsert(
          {
            event_id: prior.id,
            metro_key: metro.metro_key,
            provider,
            provider_id: providerId,
            last_seen_at: nowIso,
          },
          { onConflict: "metro_key,provider,provider_id" }
        );
        continue;
      }

      stats.newDiscovered += 1;
      const { data: inserted } = await admin
        .from("events_catalog")
        .insert({
          metro_key: metro.metro_key,
          provider,
          provider_id: providerId,
          ...patch,
          first_seen_at: nowIso,
          last_material_change_at: nowIso,
        })
        .select("id")
        .single();

      if (inserted?.id) {
        await admin.from("events_catalog_provider_links").upsert(
          {
            event_id: inserted.id as string,
            metro_key: metro.metro_key,
            provider,
            provider_id: providerId,
            last_seen_at: nowIso,
          },
          { onConflict: "metro_key,provider,provider_id" }
        );
      }
    }

    for (const row of existing) {
      if (!isEventCatalogActiveLifecycle(row.lifecycle)) continue;

      const lifecycle = resolveEventCatalogLifecycle(
        row.event_payload,
        location,
        now,
        row.verification_status === "verified"
      );

      if (lifecycle === "past" && row.lifecycle !== "past") {
        stats.expiredPast += 1;
        await admin
          .from("events_catalog")
          .update({ lifecycle: "past", updated_at: nowIso })
          .eq("id", row.id);
        continue;
      }

      if (mode === "full" && !seenKeys.has(row.dedupe_key)) {
        if (row.lifecycle === "archived" || row.lifecycle === "past") continue;
        stats.archivedMissing += 1;
        await admin
          .from("events_catalog")
          .update({ lifecycle: "archived", updated_at: nowIso })
          .eq("id", row.id);
      }
    }

    stats.estimatedCostUsd =
      stats.apiCalls * estimateProviderCallCost("serp_google_events");

    const metroPatch: Record<string, string> = { updated_at: nowIso };
    if (mode === "full" || !metro.initial_import_completed_at) {
      metroPatch.initial_import_completed_at = nowIso;
      metroPatch.last_full_sync_at = nowIso;
    }
    metroPatch.last_incremental_sync_at = nowIso;

    await admin
      .from("events_catalog_metros")
      .update(metroPatch)
      .eq("metro_key", metro.metro_key);

    if (runId) {
      await admin
        .from("events_catalog_sync_runs")
        .update({
          completed_at: new Date().toISOString(),
          api_calls: stats.apiCalls,
          raw_records_returned: stats.rawRecordsReturned,
          existing_skipped: stats.existingSkipped,
          new_discovered: stats.newDiscovered,
          changed_updated: stats.changedUpdated,
          duplicates_merged: stats.duplicatesMerged,
          records_rejected: stats.recordsRejected,
          articles_queued: stats.articlesQueued,
          estimated_cost_usd: stats.estimatedCostUsd,
          run_duration_ms: Date.now() - started,
          next_scheduled_at: nextScheduledRunAt(mode, "events"),
          diagnostics: {
            budgetAborted: budgetTracker.aborted,
            budgetAbortReason: budgetTracker.abortReason,
          },
        })
        .eq("id", runId);
    }
  } catch (err) {
    console.error("[events:catalog] sync failure", {
      metroKey: metro.metro_key,
      error: err instanceof Error ? err.message : String(err),
    });
    if (runId) {
      await admin
        .from("events_catalog_sync_runs")
        .update({
          completed_at: new Date().toISOString(),
          diagnostics: {
            error: err instanceof Error ? err.message : String(err),
          },
        })
        .eq("id", runId);
    }
  }

  return stats;
}

export async function loadEventsCatalogForEdition(
  admin: SupabaseClient,
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEvent[]> {
  const metroKey =
    options?.catalogMetroKey?.trim() || metroKeyFromEventLocation(location);
  const now = options?.now ?? new Date();
  const eventTimezone = options?.timezone ?? resolveEventTimezone(location);

  const { data, error } = await admin
    .from("events_catalog")
    .select(
      "id, metro_key, provider, provider_id, dedupe_key, name, venue, city, start_at, end_at, event_timezone, official_website, ticket_url, lifecycle, verification_status, verification_confidence, event_payload, editorial_teaser, editorial_body, image_source"
    )
    .eq("metro_key", metroKey)
    .in("lifecycle", ["verified", "upcoming", "today"])
    .order("start_at", { ascending: true })
    .limit(EDITION_EVENTS_CATALOG_READ_LIMIT);

  if (error || !data) {
    console.error("[events:catalog] read failure", { metroKey, error });
    return [];
  }

  const rows = (data as EventsCatalogRow[]).filter((row) => {
    const lifecycle = resolveEventCatalogLifecycle(
      row.event_payload,
      location,
      now,
      row.verification_status === "verified"
    );
    return isEventCatalogActiveLifecycle(lifecycle);
  });

  if (!rows.length) {
    console.log("[events:catalog] no active events", { metroKey });
    return [];
  }

  const events = rows.map(rowToLocalEvent);
  const familyFiltered = filterFamilyFriendlyEvents(events);
  if (familyFiltered.filteredCount > 0) {
    console.log("[events:catalog] family filter on read", {
      metroKey,
      filteredCount: familyFiltered.filteredCount,
      samples: familyFiltered.samples,
    });
  }
  const ranked = rankLocalEventsForEdition(familyFiltered.kept, {
    now,
    readerCity: location.city,
    readerLat: location.lat,
    readerLon: location.lon,
  });

  console.log("[events:catalog] edition read", {
    metroKey,
    stored: rows.length,
    ranked: ranked.length,
    timezone: eventTimezone,
  });

  return ranked;
}

/** All verified active catalog rows for editorial backfill (no rank cap). */
export async function loadEventsCatalogForEnrichment(
  admin: SupabaseClient,
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<LocalEvent[]> {
  const metroKey =
    options?.catalogMetroKey?.trim() || metroKeyFromEventLocation(location);
  const now = options?.now ?? new Date();

  const { data, error } = await admin
    .from("events_catalog")
    .select(
      "id, metro_key, provider, provider_id, dedupe_key, name, venue, city, start_at, end_at, event_timezone, official_website, ticket_url, lifecycle, verification_status, verification_confidence, event_payload, editorial_teaser, editorial_body, image_source"
    )
    .eq("metro_key", metroKey)
    .eq("verification_status", "verified")
    .in("lifecycle", ["verified", "upcoming", "today"])
    .order("start_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    console.error("[events:catalog] enrichment read failure", { metroKey, error });
    return [];
  }

  const rows = (data as EventsCatalogRow[]).filter((row) => {
    const lifecycle = resolveEventCatalogLifecycle(
      row.event_payload,
      location,
      now,
      row.verification_status === "verified"
    );
    return isEventCatalogActiveLifecycle(lifecycle);
  });

  const events = rows.map(rowToLocalEvent);
  const familyFiltered = filterFamilyFriendlyEvents(events);
  console.log("[events:catalog] enrichment read", {
    metroKey,
    stored: rows.length,
    afterFamilyFilter: familyFiltered.kept.length,
    filtered: familyFiltered.filteredCount,
  });
  return familyFiltered.kept;
}

export async function listEventsMetrosForSync(
  admin: SupabaseClient,
  options?: { metroKey?: string | null }
): Promise<EventsMetroRow[]> {
  let query = admin.from("events_catalog_metros").select("*");
  if (options?.metroKey) {
    query = query.eq("metro_key", options.metroKey);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[events:catalog] metro list failure", error);
    return [];
  }
  return (data ?? []) as EventsMetroRow[];
}

export async function loadArchivedEventById(
  admin: SupabaseClient,
  eventId: string
): Promise<LocalEvent | null> {
  const { data, error } = await admin
    .from("events_catalog")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToLocalEvent(data as EventsCatalogRow);
}
