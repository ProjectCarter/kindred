import { metroKeyFromPlace } from "../location/metroKey.ts";
import { buildUsMarketDirectorySeeds } from "./usMarketDirectory.ts";
import {
  KINDRED_MARKET_DEFAULT_RADIUS_MILES,
  KINDRED_MARKET_FALLBACK_RADIUS_MILES,
} from "./constants.ts";
import { haversineKm, milesToKm } from "./geo.ts";
import type { UsMarketSeedInput } from "./types.ts";

export type ResolvedEditionMarket = {
  metroKey: string;
  slug: string;
  marketName: string;
  primaryCity: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  defaultRadiusMiles: number;
  fallbackRadiusMiles: number;
  metroCities: string[];
};

export type EditionLocationInput = {
  city: string;
  state?: string | null;
  region?: string | null;
  lat: number;
  lon: number;
};

function normalizeCity(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeState(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function seedToResolved(seed: UsMarketSeedInput): ResolvedEditionMarket {
  return {
    metroKey: seed.metro_key,
    slug: seed.slug,
    marketName: seed.market_name,
    primaryCity: seed.primary_city,
    stateCode: seed.state_code,
    latitude: seed.latitude,
    longitude: seed.longitude,
    defaultRadiusMiles: KINDRED_MARKET_DEFAULT_RADIUS_MILES,
    fallbackRadiusMiles: KINDRED_MARKET_FALLBACK_RADIUS_MILES,
    metroCities: seed.metro_cities ?? [seed.primary_city],
  };
}

function cityMatchesMarket(
  city: string,
  seed: UsMarketSeedInput,
  stateCode: string
): boolean {
  if (stateCode && normalizeState(seed.state_code) !== stateCode) return false;
  const cityNorm = normalizeCity(city);
  if (normalizeCity(seed.primary_city) === cityNorm) return true;
  return (seed.metro_cities ?? []).some((member) => normalizeCity(member) === cityNorm);
}

function distanceToMarketKm(
  input: EditionLocationInput,
  seed: UsMarketSeedInput
): number {
  return haversineKm(input.lat, input.lon, seed.latitude, seed.longitude);
}

/**
 * Resolve the authoritative US market for an edition location.
 * Never maps across states. Never falls back to Gilbert/Phoenix for San Diego.
 */
export function resolveEditionMarket(
  input: EditionLocationInput
): ResolvedEditionMarket | null {
  const city = input.city?.trim();
  if (!city || city === "your area") return null;
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) return null;

  const seeds = buildUsMarketDirectorySeeds();
  const stateCode = normalizeState(input.state ?? input.region);
  const metroKey = metroKeyFromPlace({
    city,
    state: input.state,
    region: input.region,
  });

  const exactKey = seeds.find((seed) => seed.metro_key === metroKey);
  if (exactKey) return seedToResolved(exactKey);

  const byCity = seeds.find((seed) => cityMatchesMarket(city, seed, stateCode));
  if (byCity) return seedToResolved(byCity);

  const sameState = seeds.filter(
    (seed) => !stateCode || normalizeState(seed.state_code) === stateCode
  );
  let nearest: { seed: UsMarketSeedInput; km: number } | null = null;
  for (const seed of sameState) {
    const km = distanceToMarketKm(input, seed);
    const limitKm = milesToKm(KINDRED_MARKET_FALLBACK_RADIUS_MILES);
    if (km > limitKm) continue;
    if (!nearest || km < nearest.km) nearest = { seed, km };
  }
  if (nearest) return seedToResolved(nearest.seed);

  return null;
}

export function assertLocationMatchesMarket(
  input: EditionLocationInput,
  market: ResolvedEditionMarket
): { ok: true } | { ok: false; reason: string } {
  const stateCode = normalizeState(input.state ?? input.region);
  if (stateCode && stateCode !== normalizeState(market.stateCode)) {
    return {
      ok: false,
      reason: `state_mismatch:${stateCode}_vs_${market.stateCode}`,
    };
  }

  const km = haversineKm(input.lat, input.lon, market.latitude, market.longitude);
  const limitKm = milesToKm(market.fallbackRadiusMiles);
  if (km > limitKm) {
    return {
      ok: false,
      reason: `coords_outside_market:${km.toFixed(1)}km>${limitKm.toFixed(1)}km`,
    };
  }

  if (
    stateCode &&
    !cityMatchesMarket(input.city, {
      metro_key: market.metroKey,
      slug: market.slug,
      market_name: market.marketName,
      primary_city: market.primaryCity,
      state_name: "",
      state_code: market.stateCode,
      market_type: "major_metro",
      population: null,
      population_rank: null,
      latitude: market.latitude,
      longitude: market.longitude,
      timezone: "",
      metro_cities: market.metroCities,
    }, stateCode)
  ) {
    // Coordinates anchor the market when the city label is the primary city or
    // a listed member — otherwise coords must still be inside fallback radius.
    if (km > milesToKm(market.defaultRadiusMiles)) {
      return {
        ok: false,
        reason: `city_coords_mismatch:${input.city}`,
      };
    }
  }

  return { ok: true };
}

export function catalogMetroKeyForMarket(market: ResolvedEditionMarket): string {
  return market.metroKey;
}
