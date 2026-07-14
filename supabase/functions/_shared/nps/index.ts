import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { WeatherIntelligence } from "../weather/providers/types.ts";
import { getCachedNpsParks, setCachedNpsParks } from "./cache.ts";
import { fetchNpsParks, isNpsConfigured } from "./npsProvider.ts";
import { enrichNpsParksWithWeather, topNpsPlanningNote } from "./weatherHints.ts";
import type { NpsParkRecord, NpsSearchInput } from "./types.ts";

export type { NpsParkRecord, NpsAlertRecord, NpsEventRecord } from "./types.ts";
export { NPS_CACHE_TTL_HOURS } from "./types.ts";
export { npsParksAsDiscoveryItems } from "./catalog.ts";
export {
  buildNpsWeatherHint,
  enrichNpsParksWithWeather,
  topNpsPlanningNote,
} from "./weatherHints.ts";
export { fetchNpsParks, isNpsConfigured } from "./npsProvider.ts";

/**
 * Fetch NPS parks for an edition location, with cache + weather enrichment.
 */
export async function getNpsParksForEdition(
  admin: SupabaseClient | null,
  input: NpsSearchInput & { state?: string | null },
  weatherIntel?: WeatherIntelligence | null
): Promise<NpsParkRecord[]> {
  if (!isNpsConfigured()) return [];

  const cacheInput = {
    state: input.state,
    lat: input.lat,
    lon: input.lon,
  };

  const cached = admin ? await getCachedNpsParks(admin, cacheInput) : null;
  const parks = cached ?? (await fetchNpsParks(input));

  if (!cached && parks.length && admin) {
    await setCachedNpsParks(admin, cacheInput, parks);
  }

  const enriched = enrichNpsParksWithWeather(parks, weatherIntel);

  console.log("[nps] parks for edition", {
    count: enriched.length,
    cached: Boolean(cached),
    state: input.state ?? null,
    topPark: enriched[0]?.fullName?.slice(0, 40) ?? null,
    planningNote: topNpsPlanningNote(enriched, weatherIntel)?.slice(0, 80) ?? null,
  });

  return enriched;
}
