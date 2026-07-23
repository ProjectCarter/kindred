/**
 * Metro section cache pool payload shapes — shared between server build and tests.
 * Metro cache stores candidate pools, not reader-specific rankings.
 */

import {
  KINDRED_METRO_CACHE_VERSION,
  isMetroCacheVersionCurrent,
} from "./metroCacheVersion.ts";

export type MetroEventsPoolPayload = {
  poolVersion: number;
  /** Verified, desk-owned, editorial-enriched events — metro-wide. */
  eventsPool: unknown[];
  foodDrinkEventReroutes?: unknown[];
};

export type MetroPlacesPoolPayload = {
  poolVersion: number;
  localPlaces: unknown[];
};

export type MetroHistoryPoolPayload = {
  poolVersion: number;
  /** Approved history place snapshots for the metro library. */
  places: unknown[];
};

export type MetroPoolPayload =
  | MetroEventsPoolPayload
  | MetroPlacesPoolPayload
  | MetroHistoryPoolPayload;

export function isMetroPoolPayload(
  payload: unknown
): payload is MetroPoolPayload {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    typeof record.poolVersion === "number" &&
    isMetroCacheVersionCurrent(record.poolVersion)
  );
}

export function parseMetroEventsPool(payload: unknown): MetroEventsPoolPayload | null {
  if (!isMetroPoolPayload(payload)) return null;
  const record = payload as MetroEventsPoolPayload;
  if (!Array.isArray(record.eventsPool)) return null;
  return record;
}

export function parseMetroPlacesPool(payload: unknown): MetroPlacesPoolPayload | null {
  if (!isMetroPoolPayload(payload)) return null;
  const record = payload as MetroPlacesPoolPayload;
  if (!Array.isArray(record.localPlaces)) return null;
  return record;
}

export function parseMetroHistoryPool(payload: unknown): MetroHistoryPoolPayload | null {
  if (!isMetroPoolPayload(payload)) return null;
  const record = payload as MetroHistoryPoolPayload;
  if (!Array.isArray(record.places)) return null;
  return record;
}

export function buildMetroEventsPoolPayload(input: {
  eventsPool: unknown[];
  foodDrinkEventReroutes?: unknown[];
}): MetroEventsPoolPayload {
  return {
    poolVersion: KINDRED_METRO_CACHE_VERSION,
    eventsPool: input.eventsPool,
    foodDrinkEventReroutes: input.foodDrinkEventReroutes ?? [],
  };
}

export function buildMetroPlacesPoolPayload(localPlaces: unknown[]): MetroPlacesPoolPayload {
  return {
    poolVersion: KINDRED_METRO_CACHE_VERSION,
    localPlaces,
  };
}

export function buildMetroHistoryPoolPayload(places: unknown[]): MetroHistoryPoolPayload {
  return {
    poolVersion: KINDRED_METRO_CACHE_VERSION,
    places,
  };
}
