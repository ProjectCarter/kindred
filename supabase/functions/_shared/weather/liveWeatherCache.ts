import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { LiveWeatherPayload } from "./liveWeather.ts";

export const LIVE_WEATHER_CACHE_PROVIDER = "live_weather_v4";
/** Bumped when condition normalization logic changes — aids deploy verification. */
export const LIVE_WEATHER_NORMALIZATION_VERSION = "openweather-current-condition-v1";
export const LIVE_WEATHER_CACHE_TTL_MINUTES = 12;

async function hashQuery(provider: string, query: string): Promise<string> {
  const data = new TextEncoder().encode(`${provider}:${query}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function getCachedLiveWeather(
  admin: SupabaseClient | null,
  lat: number,
  lon: number
): Promise<LiveWeatherPayload | null> {
  if (!admin) return null;
  const query = cacheKey(lat, lon);
  const queryHash = await hashQuery(LIVE_WEATHER_CACHE_PROVIDER, query);
  const { data } = await admin
    .from("kindred_image_search_cache")
    .select("results_json, expires_at")
    .eq("provider", LIVE_WEATHER_CACHE_PROVIDER)
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const results = data.results_json;
  if (!Array.isArray(results) || !results[0]) return null;
  return results[0] as LiveWeatherPayload;
}

export async function setCachedLiveWeather(
  admin: SupabaseClient | null,
  lat: number,
  lon: number,
  payload: LiveWeatherPayload
): Promise<void> {
  if (!admin) return;
  const query = cacheKey(lat, lon);
  const queryHash = await hashQuery(LIVE_WEATHER_CACHE_PROVIDER, query);
  const expiresAt = new Date(
    Date.now() + LIVE_WEATHER_CACHE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  await admin.from("kindred_image_search_cache").upsert(
    {
      provider: LIVE_WEATHER_CACHE_PROVIDER,
      query_hash: queryHash,
      query_text: query,
      results_json: [payload],
      expires_at: expiresAt,
    },
    { onConflict: "provider,query_hash" }
  );
}
