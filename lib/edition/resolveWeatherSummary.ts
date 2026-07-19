/**
 * Resolve weather summary from persisted edition surfaces — network intelligence
 * or cache bundle. Mirrors resolveHistoryAroundTown.ts.
 */

import type { CachedEditionBundle } from "./editionCache";
import type { EditionIntelligence } from "./surfaceIntelligence";
import { extractWeatherSummaryFromEditorialContext } from "../weather/parseWeatherSummary.ts";

export function resolveWeatherSummary(input: {
  intelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  editorialContext?: unknown;
}): string | null {
  const fromIntel = input.intelligence?.weatherSummary?.trim() || null;
  if (fromIntel) return fromIntel;

  const fromBundle =
    input.cachedBundle?.intelligence?.weatherSummary?.trim() || null;
  if (fromBundle) return fromBundle;

  return extractWeatherSummaryFromEditorialContext(input.editorialContext);
}

export function mergeWeatherSummaryIntoIntelligence(
  intelligence: EditionIntelligence | null,
  weatherSummary: string | null
): EditionIntelligence | null {
  const summary = weatherSummary?.trim() || null;
  if (!summary) return intelligence;
  if (!intelligence) return null;
  if (intelligence.weatherSummary === summary) return intelligence;
  return { ...intelligence, weatherSummary: summary };
}

/** True when network edition has weather the on-screen cache/state lacks or differs. */
export function needsNetworkWeatherSummaryMerge(input: {
  networkIntelligence: EditionIntelligence | null;
  onScreenIntelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  editorialContext?: unknown;
}): boolean {
  const network = resolveWeatherSummary({
    intelligence: input.networkIntelligence,
    editorialContext: input.editorialContext,
  });
  if (!network) return false;

  const onScreen = resolveWeatherSummary({
    intelligence: input.onScreenIntelligence,
    cachedBundle: input.cachedBundle,
  });
  return onScreen !== network;
}
