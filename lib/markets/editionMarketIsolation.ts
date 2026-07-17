import { normalizeCityKey } from "../location/locationKey";
import { haversineKm, milesToKm } from "./geo";
import type { ResolvedEditionMarket } from "./resolveEditionMarket";

export type MarketIsolationRejection = {
  kind: "event" | "place" | "discovery";
  name: string;
  reason: string;
  sourceCity?: string | null;
  distanceKm?: number | null;
};

export type MarketIsolationResult<T> = {
  kept: T[];
  rejected: MarketIsolationRejection[];
};

export type EditionMarketAnchor = {
  lat: number;
  lon: number;
  city: string;
  state?: string | null;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: "alabama",
  AZ: "arizona",
  CA: "california",
  WA: "washington",
  // Enough for cross-state rejection without a full dictionary.
};

function foreignStatePattern(stateCode: string): RegExp | null {
  const own = stateCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(own)) return null;
  const patterns: string[] = [];
  for (const [code, name] of Object.entries(US_STATE_NAMES)) {
    if (code === own) continue;
    patterns.push(`\\b${name}\\b`, `\\b${code}\\b`);
  }
  return patterns.length ? new RegExp(patterns.join("|"), "i") : null;
}

function haystackFromParts(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => typeof p === "string" && p.trim()).join(" ");
}

function distanceWithinMarket(
  itemLat: number | null | undefined,
  itemLon: number | null | undefined,
  market: ResolvedEditionMarket,
  anchor: EditionMarketAnchor
): { ok: boolean; distanceKm: number | null; reason?: string } {
  const limitKm = milesToKm(market.fallbackRadiusMiles);

  if (
    typeof itemLat === "number" &&
    Number.isFinite(itemLat) &&
    typeof itemLon === "number" &&
    Number.isFinite(itemLon)
  ) {
    const fromMarket = haversineKm(
      itemLat,
      itemLon,
      market.latitude,
      market.longitude
    );
    if (fromMarket <= limitKm) {
      return { ok: true, distanceKm: fromMarket };
    }
    const fromAnchor = haversineKm(itemLat, itemLon, anchor.lat, anchor.lon);
    if (fromAnchor <= limitKm) {
      return { ok: true, distanceKm: fromAnchor };
    }
    return {
      ok: false,
      distanceKm: fromMarket,
      reason: `coordinates_outside_market:${fromMarket.toFixed(1)}km`,
    };
  }

  return { ok: true, distanceKm: null };
}

function cityBelongsToMarket(
  city: string | null | undefined,
  market: ResolvedEditionMarket
): boolean {
  if (!city?.trim()) return true;
  const key = normalizeCityKey(city);
  const members = new Set(
    [market.primaryCity, ...market.metroCities].map((c) => normalizeCityKey(c))
  );
  return members.has(key);
}

function rejectForeignStateText(
  hay: string,
  market: ResolvedEditionMarket
): string | null {
  const foreign = foreignStatePattern(market.stateCode);
  if (!foreign) return null;
  if (foreign.test(hay)) {
    return `foreign_state_for_${market.stateCode}`;
  }
  return null;
}

export type IsolatedLocalEvent = {
  name: string;
  venue: string;
  city: string;
  lat?: number | null;
  lon?: number | null;
};

export function filterLocalEventsByMarket<T extends IsolatedLocalEvent>(
  events: T[],
  market: ResolvedEditionMarket,
  anchor: EditionMarketAnchor
): MarketIsolationResult<T> {
  const kept: T[] = [];
  const rejected: MarketIsolationRejection[] = [];

  for (const event of events) {
    const hay = haystackFromParts([event.name, event.venue, event.city]);
    const foreignState = rejectForeignStateText(hay, market);
    if (foreignState) {
      rejected.push({
        kind: "event",
        name: event.name,
        reason: foreignState,
        sourceCity: event.city,
      });
      continue;
    }

    if (event.city?.trim() && !cityBelongsToMarket(event.city, market)) {
      const dist = distanceWithinMarket(event.lat, event.lon, market, anchor);
      if (!dist.ok) {
        rejected.push({
          kind: "event",
          name: event.name,
          reason: dist.reason ?? `city_not_in_market:${event.city}`,
          sourceCity: event.city,
          distanceKm: dist.distanceKm,
        });
        continue;
      }
    }

    const dist = distanceWithinMarket(event.lat, event.lon, market, anchor);
    if (!dist.ok) {
      rejected.push({
        kind: "event",
        name: event.name,
        reason: dist.reason ?? "outside_market_radius",
        sourceCity: event.city,
        distanceKm: dist.distanceKm,
      });
      continue;
    }

    kept.push(event);
  }

  return { kept, rejected };
}

export type IsolatedPlace = {
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
};

export function filterPlacesByMarket<T extends IsolatedPlace>(
  places: T[],
  market: ResolvedEditionMarket,
  anchor: EditionMarketAnchor
): MarketIsolationResult<T> {
  const kept: T[] = [];
  const rejected: MarketIsolationRejection[] = [];

  for (const place of places) {
    const hay = haystackFromParts([
      place.name,
      place.city,
      place.state,
      place.address,
    ]);
    const foreignState = rejectForeignStateText(hay, market);
    if (foreignState) {
      rejected.push({
        kind: "place",
        name: place.name,
        reason: foreignState,
        sourceCity: place.city ?? null,
      });
      continue;
    }

    if (place.state?.trim()) {
      const placeState = place.state.trim().toUpperCase();
      if (placeState !== market.stateCode.toUpperCase()) {
        rejected.push({
          kind: "place",
          name: place.name,
          reason: `place_state_mismatch:${placeState}`,
          sourceCity: place.city ?? null,
        });
        continue;
      }
    }

    if (place.city?.trim() && !cityBelongsToMarket(place.city, market)) {
      const dist = distanceWithinMarket(place.lat, place.lon, market, anchor);
      if (!dist.ok) {
        rejected.push({
          kind: "place",
          name: place.name,
          reason: dist.reason ?? `city_not_in_market:${place.city}`,
          sourceCity: place.city,
          distanceKm: dist.distanceKm,
        });
        continue;
      }
    }

    const dist = distanceWithinMarket(place.lat, place.lon, market, anchor);
    if (!dist.ok) {
      rejected.push({
        kind: "place",
        name: place.name,
        reason: dist.reason ?? "outside_market_radius",
        sourceCity: place.city ?? null,
        distanceKm: dist.distanceKm,
      });
      continue;
    }

    kept.push(place);
  }

  return { kept, rejected };
}

export function logMarketIsolationRejections(
  traceId: string | null | undefined,
  scope: string,
  market: ResolvedEditionMarket,
  rejected: MarketIsolationRejection[]
): void {
  if (!rejected.length) return;
  console.log("[edition:market-isolation]", {
    traceId: traceId ?? null,
    scope,
    metroKey: market.metroKey,
    stateCode: market.stateCode,
    rejectedCount: rejected.length,
    samples: rejected.slice(0, 8),
  });
}
