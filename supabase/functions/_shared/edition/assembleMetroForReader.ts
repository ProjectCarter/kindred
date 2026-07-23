/**
 * Reader assembly — rank/filter metro candidate pools for a specific reader.
 * Deterministic only; no Claude calls.
 */

import type { LocalEvent } from "../localEvents/provider.ts";
import { allocateLocalEventsByHorizon } from "../localEvents/horizonAllocator.ts";
import { rankLocalEventsForEdition } from "../localEvents/ranking.ts";
import {
  LOCAL_EVENTS_EDITION_SURFACED_MAX,
} from "../editorial/publishing.ts";
import { eventHasPublishableEditorial } from "../localEvents/banditNotes.ts";
import type { NormalizedPlace } from "../places/types.ts";
import { runDiscoveryDecisions } from "../discovery/index.ts";
import type { DiscoveryPayload } from "../discovery/types.ts";
import { allocateDiscoverySections } from "../discovery/sectionAllocation.ts";
import { buildLocalEventsBody } from "../buildEdition.ts";
import type {
  HistoryAroundTownEditionPayload,
  HistoryPlaceSnapshot,
} from "../historyAroundTown/types.ts";
import {
  HISTORY_AROUND_TOWN_CAROUSEL_LIMIT,
  HISTORY_AROUND_TOWN_SUBTITLE,
} from "../historyAroundTown/types.ts";
import { haversineKm } from "../discovery/geo.ts";
import {
  DISCOVERY_HISTORICAL_PLACES_RADIUS_KM,
} from "../../../../lib/edition/discoveryGeography.ts";
import { parseMetroEventsPool, parseMetroHistoryPool } from "../../../../lib/edition/metroPoolPayload.ts";

export type ReaderAssemblyContext = {
  editionDate: string;
  city: string;
  region?: string | null;
  state?: string | null;
  readerLat?: number | null;
  readerLon?: number | null;
  interests?: string[];
  followedTopics?: string[];
  favoriteSources?: string[];
};

function eventDedupeKey(event: LocalEvent): string {
  return `${event.name}|${event.startDateTime}`.toLowerCase();
}

/** Rank + horizon allocate from a shared metro events pool. */
export function assembleLocalEventsFromPool(
  pool: LocalEvent[],
  ctx: ReaderAssemblyContext,
  options?: { now?: Date; maxTotal?: number }
): LocalEvent[] {
  const now = options?.now ?? new Date(
    Number(ctx.editionDate.slice(0, 4)),
    Number(ctx.editionDate.slice(5, 7)) - 1,
    Number(ctx.editionDate.slice(8, 10))
  );
  const ranked = rankLocalEventsForEdition(pool, {
    now,
    readerCity: ctx.city,
    readerLat: ctx.readerLat,
    readerLon: ctx.readerLon,
  });
  const allocated = allocateLocalEventsByHorizon(ranked, {
    maxTotal: options?.maxTotal ?? LOCAL_EVENTS_EDITION_SURFACED_MAX,
    now,
    readerCity: ctx.city,
    readerLat: ctx.readerLat,
    readerLon: ctx.readerLon,
  });
  return allocated.filter((event) => eventHasPublishableEditorial(event));
}

export function buildLocalEventsSectionFromPool(
  cachedPayload: unknown,
  ctx: ReaderAssemblyContext
): { localEvents: LocalEvent[]; sectionBody: string; foodDrinkEventReroutes: LocalEvent[] } | null {
  const parsed = parseMetroEventsPool(cachedPayload);
  if (!parsed?.eventsPool.length) return null;
  const pool = parsed.eventsPool as LocalEvent[];
  const localEvents = assembleLocalEventsFromPool(pool, ctx);
  if (!localEvents.length) return null;
  const sectionBody = buildLocalEventsBody(localEvents, { editionCity: ctx.city });
  return {
    localEvents,
    sectionBody,
    foodDrinkEventReroutes: (parsed.foodDrinkEventReroutes ?? []) as LocalEvent[],
  };
}

export function assembleDiscoveryFromPlacesPool(input: {
  localPlaces: NormalizedPlace[];
  localEvents: LocalEvent[];
  ctx: ReaderAssemblyContext;
  recentKeys?: string[];
}): DiscoveryPayload {
  return runDiscoveryDecisions({
    editionDate: input.ctx.editionDate,
    now: new Date(),
    city: input.ctx.city,
    region: input.ctx.region,
    state: input.ctx.state,
    readerLat: input.ctx.readerLat,
    readerLon: input.ctx.readerLon,
    interests: input.ctx.interests ?? [],
    followedTopics: input.ctx.followedTopics ?? [],
    favoriteSources: input.ctx.favoriteSources ?? [],
    weatherSummary: null,
    weatherIntel: null,
    npsParks: [],
    isWeekend: false,
    isSunday: false,
    localEvents: input.localEvents,
    localPlaces: input.localPlaces,
    recentKeys: input.recentKeys ?? [],
  });
}

export function buildFoodDrinksSectionBodyFromDiscovery(
  discovery: DiscoveryPayload
): string | null {
  const allocation = allocateDiscoverySections(discovery);
  const foodItems = allocation.recommendations;
  if (!foodItems.length) return null;
  return JSON.stringify({
    version: 1,
    items: foodItems.map((item) => ({
      id: item.item.id,
      title: item.item.title,
      category: item.item.category,
      score: item.score,
    })),
  });
}

function filterHistoryPlacesWithinRadius(
  places: HistoryPlaceSnapshot[],
  ctx: ReaderAssemblyContext
): HistoryPlaceSnapshot[] {
  const readerLat = ctx.readerLat;
  const readerLon = ctx.readerLon;
  if (
    typeof readerLat !== "number" ||
    !Number.isFinite(readerLat) ||
    typeof readerLon !== "number" ||
    !Number.isFinite(readerLon)
  ) {
    return places;
  }
  const withinRadius = places.filter((place) => {
    if (place.lat == null || place.lon == null) return false;
    return (
      haversineKm(readerLat, readerLon, place.lat, place.lon) <=
      DISCOVERY_HISTORICAL_PLACES_RADIUS_KM
    );
  });
  return withinRadius.length ? withinRadius : places;
}

function diversifyHistoryCarousel(places: HistoryPlaceSnapshot[]): HistoryPlaceSnapshot[] {
  const byCategory = new Map<string, HistoryPlaceSnapshot[]>();
  for (const place of places) {
    const list = byCategory.get(place.category) ?? [];
    list.push(place);
    byCategory.set(place.category, list);
  }
  const picked: HistoryPlaceSnapshot[] = [];
  const seen = new Set<string>();
  const categories = [...byCategory.keys()];
  while (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    let added = false;
    for (const cat of categories) {
      const pool = byCategory.get(cat) ?? [];
      const next = pool.find((row) => !seen.has(row.id));
      if (!next) continue;
      picked.push(next);
      seen.add(next.id);
      added = true;
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
    if (!added) break;
  }
  if (picked.length < HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) {
    for (const place of places) {
      if (seen.has(place.id)) continue;
      picked.push(place);
      seen.add(place.id);
      if (picked.length >= HISTORY_AROUND_TOWN_CAROUSEL_LIMIT) break;
    }
  }
  return picked;
}

export function assembleHistoryAroundTownFromPool(
  cachedPayload: unknown,
  ctx: ReaderAssemblyContext,
  metroKey: string
): HistoryAroundTownEditionPayload | null {
  const parsed = parseMetroHistoryPool(cachedPayload);
  if (!parsed?.places.length) return null;
  const allPlaces = parsed.places as HistoryPlaceSnapshot[];
  const filtered = filterHistoryPlacesWithinRadius(allPlaces, ctx);
  if (!filtered.length) return null;
  const carousel = diversifyHistoryCarousel(filtered);
  if (!carousel.length) return null;
  return {
    metroKey,
    subtitle: HISTORY_AROUND_TOWN_SUBTITLE,
    carousel,
    places: filtered,
  };
}

export { eventDedupeKey };
