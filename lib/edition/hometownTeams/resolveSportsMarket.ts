/**
 * Resolve the sports market for an edition from city / metro metadata.
 */

import { metroKeyFromPlace } from "../../location/metroKey";
import { resolveLocation } from "../hero/location";
import {
  getSportsMarketById,
  SPORTS_MARKET_CATALOG,
  type SportsMarketId,
} from "./catalog";

export type SportsMarketLocationInput = {
  city?: string | null;
  state?: string | null;
  region?: string | null;
  metroKey?: string | null;
};

function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metroKeyFromInput(input: SportsMarketLocationInput): string | null {
  if (input.metroKey?.trim()) return input.metroKey.trim();
  if (!input.city?.trim()) return null;
  return metroKeyFromPlace({
    city: input.city,
    state: input.state,
    region: input.region,
  });
}

function marketFromMetroKey(metroKey: string | null): SportsMarketId | null {
  if (!metroKey) return null;
  for (const market of SPORTS_MARKET_CATALOG) {
    if ((market.metroKeys as readonly string[]).includes(metroKey)) {
      return market.id;
    }
  }
  return null;
}

function marketFromCityAliases(city: string | null | undefined): SportsMarketId | null {
  const needle = normalizePlace(city ?? "");
  if (!needle) return null;

  for (const market of SPORTS_MARKET_CATALOG) {
    for (const alias of market.cityAliases) {
      const normalizedAlias = normalizePlace(alias);
      if (needle === normalizedAlias || needle.includes(normalizedAlias)) {
        return market.id;
      }
    }
  }
  return null;
}

function marketFromHeroMetro(city: string | null | undefined): SportsMarketId | null {
  const resolved = resolveLocation({ city });
  const metro = resolved.metro?.trim();
  if (!metro) return null;

  const needle = normalizePlace(metro);
  for (const market of SPORTS_MARKET_CATALOG) {
    if (normalizePlace(market.label) === needle) return market.id;
    if (needle.includes(normalizePlace(market.label))) return market.id;
  }
  return null;
}

/** Determine the sports market for this edition's location. */
export function resolveSportsMarketId(
  input: SportsMarketLocationInput
): SportsMarketId | null {
  const fromMetroKey = marketFromMetroKey(metroKeyFromInput(input));
  if (fromMetroKey) return fromMetroKey;

  const fromHeroMetro = marketFromHeroMetro(input.city);
  if (fromHeroMetro) return fromHeroMetro;

  return marketFromCityAliases(input.city);
}

export function resolveSportsMarketLabel(
  marketId: string | null | undefined
): string | null {
  return getSportsMarketById(marketId)?.label ?? null;
}
