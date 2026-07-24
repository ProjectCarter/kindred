// Kindred — shared live-refresh logic
//
// The overnight/on-demand pipeline (buildEdition.ts) writes the printed
// paper once: Lead, Top Stories, Bandit's Pick, the opening, recommendation
// copy. None of that is touched here — a real newspaper doesn't rewrite its
// own front page at 2pm. This module only refreshes the *structured, factual*
// layer that legitimately changes during the day (event times/cancellations/
// ticket links, and which cached places currently qualify as recommendable),
// and only ever patches the specific rows that hold that structured data.
//
// Two callers share this module:
//   - refresh-live-data (per-user, client-triggered, right after a ready
//     edition opens)
//   - sweep-live-refresh (cron-triggered, batches every ready edition that
//     hasn't been refreshed recently, so freshness doesn't depend on anyone
//     having the app open)

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  buildLocalEventsBody,
  getLocalEvents,
  type LocalEvent,
  type LocalEventLocation,
} from "./localEvents/provider.ts";
import { resolveEventTimezone } from "./localEvents/eventTimezone.ts";
import { assertEventsVerifiedForPublication } from "./localEvents/eventDateVerification.ts";
import { allocateLocalEventsByHorizon } from "./localEvents/horizonAllocator.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX, HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorial/publishing.ts";
import { surfaceLocalEventsForEdition } from "./localEvents/surfaceLocalEventsForEdition.ts";
import { isUsHolidayOrEve } from "./calendar/holidays.ts";
import { getLocalPlacesForEdition } from "./places/index.ts";
import { runDiscoveryDecisions } from "./discovery/index.ts";
import {
  tryPersistDiscoveryUpdate,
} from "./editionCompleteness.ts";
import {
  catalogMetroKeyForReaderLocation,
  logDiscoveryGeography,
  resolveDiscoveryGeographySnapshot,
  resolveEditionMarketForReader,
} from "./editorial/discoveryGeography.ts";
import { filterLocalEventsByMarket } from "../../../lib/markets/editionMarketIsolation.ts";
import {
  isLocalEventsMetroCacheValidToday,
  loadValidMetroSectionCache,
} from "./edition/metroSectionCache.ts";
import { buildLocalEventsSectionFromPool } from "./edition/assembleMetroForReader.ts";

export type LiveRefreshLocation = LocalEventLocation;

export type LiveRefreshInput = {
  editionId: string;
  userId: string;
  editionDate: string; // YYYY-MM-DD, the edition's own local date
  metroKey?: string | null;
  location: LiveRefreshLocation;
  /** Only needed to re-run Discovery's interest-weighted selection. */
  interests?: string[];
};

export type LiveRefreshResult = {
  events: { ok: boolean; changed: boolean; count: number; error?: string };
  discovery: { ok: boolean; changed: boolean; error?: string };
};

function liveRefreshCatalogContext(location: LiveRefreshLocation) {
  const editionMarket = resolveEditionMarketForReader({
    city: location.city,
    state: location.state ?? null,
    region: location.region ?? null,
    lat: location.lat,
    lon: location.lon,
  });
  const catalogMetroKey = catalogMetroKeyForReaderLocation({
    city: location.city,
    state: location.state ?? null,
    region: location.region ?? null,
    lat: location.lat,
    lon: location.lon,
  });
  logDiscoveryGeography(
    "liveRefresh",
    resolveDiscoveryGeographySnapshot({
      city: location.city,
      market: editionMarket,
    }),
    { catalogMetroKey }
  );
  return {
    catalogMetroKey,
    editionMarket,
    marketAnchor: {
      lat: location.lat,
      lon: location.lon,
      city: location.city,
      state: location.state ?? null,
    },
  };
}

function isBusyDayFor(editionDate: string): boolean {
  const [y, m, d] = editionDate.split("-").map(Number);
  const dateObj = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dow = dateObj.getDay();
  return dow === 0 || dow === 6 || isUsHolidayOrEve(dateObj);
}

async function persistLocalEventsSectionBody(
  admin: SupabaseClient,
  editionId: string,
  body: string,
  eventCount: number
): Promise<{ ok: boolean; changed: boolean; count: number; error?: string }> {
  const { data: existing, error: existingError } = await admin
    .from("edition_sections")
    .select("id, body, position")
    .eq("edition_id", editionId)
    .eq("section_type", "local_events")
    .maybeSingle();

  if (existingError) {
    return { ok: false, changed: false, count: 0, error: existingError.message };
  }

  if (existing?.id) {
    if (existing.body === body) {
      return { ok: true, changed: false, count: eventCount };
    }
    const { error: updateError } = await admin
      .from("edition_sections")
      .update({ body })
      .eq("id", existing.id);
    if (updateError) {
      return { ok: false, changed: false, count: eventCount, error: updateError.message };
    }
    return { ok: true, changed: true, count: eventCount };
  }

  const { data: maxPos } = await admin
    .from("edition_sections")
    .select("position")
    .eq("edition_id", editionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxPos?.position ?? 0) + 1;
  const { error: insertError } = await admin.from("edition_sections").insert({
    edition_id: editionId,
    section_type: "local_events",
    position,
    headline: "A Few Things Happening Around Town",
    body,
    source_note: "Curated from trusted local event sources",
  });
  if (insertError) {
    return { ok: false, changed: false, count: eventCount, error: insertError.message };
  }
  return { ok: true, changed: true, count: eventCount };
}

/**
 * Re-fetch events (times, cancellations, ticket links, photography) and
 * patch only the `local_events` edition_sections row. Structured JSON in,
 * structured JSON out — no Anthropic call, so this never touches anything
 * a reader would recognize as "the writing."
 */
export async function refreshEventsSection(
  admin: SupabaseClient,
  input: LiveRefreshInput
): Promise<{ ok: boolean; changed: boolean; count: number; error?: string }> {
  try {
    const eventTimezone = resolveEventTimezone(input.location);
    const metroKey = input.metroKey?.trim() || null;

    if (
      metroKey &&
      (await isLocalEventsMetroCacheValidToday(
        admin,
        metroKey,
        input.editionDate
      ))
    ) {
      const { record: cachedEvents } = await loadValidMetroSectionCache(admin, {
        sectionType: "local_events",
        metroKey,
        editionDate: input.editionDate,
      });
      if (cachedEvents?.payload) {
        const assembled = buildLocalEventsSectionFromPool(
          cachedEvents.payload,
          {
            editionDate: input.editionDate,
            city: input.location.city,
            region: input.location.region ?? null,
            state: input.location.state ?? null,
            readerLat: input.location.lat,
            readerLon: input.location.lon,
          }
        );
        if (assembled?.sectionBody?.trim() && assembled.localEvents.length > 0) {
          return persistLocalEventsSectionBody(
            admin,
            input.editionId,
            assembled.sectionBody,
            assembled.localEvents.length
          );
        }
      }
    }

    const { catalogMetroKey, editionMarket, marketAnchor } =
      liveRefreshCatalogContext(input.location);
    let fetched: LocalEvent[] = await getLocalEvents(input.location, {
      isBusyDay: isBusyDayFor(input.editionDate),
      now: new Date(),
      editionDate: input.editionDate,
      timezone: eventTimezone,
      admin,
      catalogMetroKey,
    });
    fetched = filterLocalEventsByMarket(fetched, editionMarket, marketAnchor).kept;

    if (fetched.length === 0) {
      // Never blank out a section on a transient empty provider response.
      return { ok: true, changed: false, count: 0 };
    }

    const surfaced = allocateLocalEventsByHorizon(fetched, {
      maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
      now: new Date(),
      readerCity: input.location.city,
    });

    const reservePool = fetched.filter(
      (candidate) =>
        !surfaced.some(
          (picked) =>
            `${picked.name}|${picked.startDateTime}`.toLowerCase() ===
            `${candidate.name}|${candidate.startDateTime}`.toLowerCase()
        )
    );

    const publishable = await surfaceLocalEventsForEdition(surfaced, reservePool, {
      editionDate: input.editionDate,
      allowAiEnrichment:
        Boolean(Deno.env.get("ANTHROPIC_API_KEY")) &&
        !(input.metroKey
          ? await isLocalEventsMetroCacheValidToday(
              admin,
              input.metroKey,
              input.editionDate
            )
          : false),
      homepageMinimum: HOMEPAGE_INITIAL_RENDER_COUNT,
      now: new Date(),
      readerCity: input.location.city,
    });

    const events = assertEventsVerifiedForPublication(publishable, {
        now: new Date(),
        location: input.location,
        eventTimezone,
        editionDate: input.editionDate,
      }
    );

    if (events.length === 0) {
      return { ok: true, changed: false, count: 0 };
    }
    const { isEventbriteOnlyMode } = await import("./localEvents/eventbriteOnlyMode.ts");
    const body = buildLocalEventsBody(events, {
      eventbriteOnly: isEventbriteOnlyMode(),
      editionCity: input.location.city,
    });

    return persistLocalEventsSectionBody(
      admin,
      input.editionId,
      body,
      events.length
    );
  } catch (err) {
    return {
      ok: false,
      changed: false,
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Recompute the rule-based Discovery Engine payload (which cached places
 * currently qualify, weekend escapes, Bandit's Notebook source data) and
 * patch only `editions.discovery`. Places themselves — and their AI "why"
 * notes — are cached independently with their own TTL; this just re-runs
 * the deterministic selection over whatever is current in that cache. No
 * Anthropic call here either.
 */
export async function refreshDiscoveryData(
  admin: SupabaseClient,
  input: LiveRefreshInput
): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  try {
    const [y, m, d] = input.editionDate.split("-").map(Number);
    const dateObj = new Date(y, (m ?? 1) - 1, d ?? 1);
    const dow = dateObj.getDay();
    const isSaturday = dow === 6;
    const isSunday = dow === 0;
    const isWeekend = isSaturday || isSunday;
    const isBusyDay = isWeekend || isUsHolidayOrEve(dateObj);

    const eventTimezone = resolveEventTimezone(input.location);
    const { catalogMetroKey } = liveRefreshCatalogContext(input.location);
    const [localEvents, localPlaces] = await Promise.all([
      getLocalEvents(input.location, {
        isBusyDay,
        now: new Date(),
        editionDate: input.editionDate,
        timezone: eventTimezone,
        admin,
        catalogMetroKey,
      }),
      getLocalPlacesForEdition(admin, input.location, { catalogMetroKey }),
    ]);

    const discovery = runDiscoveryDecisions({
      editionDate: input.editionDate,
      now: new Date(),
      city: input.location.city,
      region: input.location.region ?? null,
      state: input.location.state ?? null,
      readerLat: input.location.lat,
      readerLon: input.location.lon,
      interests: input.interests ?? [],
      followedTopics: [],
      favoriteSources: [],
      isWeekend,
      isSunday,
      localEvents: localEvents.map((e) => ({
        name: e.name,
        startDateTime: e.startDateTime,
        venue: e.venue,
        city: e.city,
        sourceUrl: e.sourceUrl,
        sourceName: e.sourceName,
      })),
      localPlaces,
      recentKeys: [],
    });

    return tryPersistDiscoveryUpdate(admin, {
      editionId: input.editionId,
      candidateDiscovery: discovery,
      logPrefix: "[liveRefresh]",
    });
  } catch (err) {
    return {
      ok: false,
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Single entry point both refresh-live-data and sweep-live-refresh call.
 * The two refreshes are independent of each other — one failing must never
 * block or roll back the other.
 */
export async function refreshLiveDataForEdition(
  admin: SupabaseClient,
  input: LiveRefreshInput
): Promise<LiveRefreshResult> {
  const [eventsResult, discoveryResult] = await Promise.all([
    refreshEventsSection(admin, input),
    refreshDiscoveryData(admin, input),
  ]);

  return {
    events: {
      ok: eventsResult.ok,
      changed: eventsResult.changed,
      count: eventsResult.count,
      error: eventsResult.error,
    },
    discovery: discoveryResult,
  };
}
