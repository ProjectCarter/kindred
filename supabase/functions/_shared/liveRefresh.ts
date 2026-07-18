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
import { enrichEventsWithBanditNotes } from "./localEvents/banditNotes.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "./editorial/publishing.ts";
import { isUsHolidayOrEve } from "./calendar/holidays.ts";
import { getLocalPlacesForEdition } from "./places/index.ts";
import { runDiscoveryDecisions } from "./discovery/index.ts";
import {
  tryPersistDiscoveryUpdate,
} from "./editionCompleteness.ts";

export type LiveRefreshLocation = LocalEventLocation;

export type LiveRefreshInput = {
  editionId: string;
  userId: string;
  editionDate: string; // YYYY-MM-DD, the edition's own local date
  location: LiveRefreshLocation;
  /** Only needed to re-run Discovery's interest-weighted selection. */
  interests?: string[];
};

export type LiveRefreshResult = {
  events: { ok: boolean; changed: boolean; count: number; error?: string };
  discovery: { ok: boolean; changed: boolean; error?: string };
};

function isBusyDayFor(editionDate: string): boolean {
  const [y, m, d] = editionDate.split("-").map(Number);
  const dateObj = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dow = dateObj.getDay();
  return dow === 0 || dow === 6 || isUsHolidayOrEve(dateObj);
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
    const fetched: LocalEvent[] = await getLocalEvents(input.location, {
      isBusyDay: isBusyDayFor(input.editionDate),
      now: new Date(),
      editionDate: input.editionDate,
      timezone: eventTimezone,
      admin,
    });

    if (fetched.length === 0) {
      // Never blank out a section on a transient empty provider response.
      return { ok: true, changed: false, count: 0 };
    }

    const surfaced = allocateLocalEventsByHorizon(fetched, {
      maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
      now: new Date(),
      readerCity: input.location.city,
    });

    const events = assertEventsVerifiedForPublication(
      await enrichEventsWithBanditNotes(surfaced, {
        editionDate: input.editionDate,
      }),
      {
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

    const { data: existing, error: existingError } = await admin
      .from("edition_sections")
      .select("id, body, position")
      .eq("edition_id", input.editionId)
      .eq("section_type", "local_events")
      .maybeSingle();

    if (existingError) {
      return { ok: false, changed: false, count: 0, error: existingError.message };
    }

    if (existing?.id) {
      if (existing.body === body) {
        return { ok: true, changed: false, count: events.length };
      }
      const { error: updateError } = await admin
        .from("edition_sections")
        .update({ body })
        .eq("id", existing.id);
      if (updateError) {
        return { ok: false, changed: false, count: events.length, error: updateError.message };
      }
      return { ok: true, changed: true, count: events.length };
    }

    // No local_events row on this edition yet (e.g. it built on a quiet day) —
    // add one now that events exist, same shape buildEdition.ts would write.
    const { data: maxPos } = await admin
      .from("edition_sections")
      .select("position")
      .eq("edition_id", input.editionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (maxPos?.position ?? 0) + 1;
    const { error: insertError } = await admin.from("edition_sections").insert({
      edition_id: input.editionId,
      section_type: "local_events",
      position,
      headline: "A Few Things Happening Around Town",
      body,
      source_note: "Sourced from Google Events",
    });
    if (insertError) {
      return { ok: false, changed: false, count: events.length, error: insertError.message };
    }
    return { ok: true, changed: true, count: events.length };
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
    const [localEvents, localPlaces] = await Promise.all([
      getLocalEvents(input.location, {
        isBusyDay,
        now: new Date(),
        editionDate: input.editionDate,
        timezone: eventTimezone,
        admin,
      }),
      getLocalPlacesForEdition(admin, input.location),
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
