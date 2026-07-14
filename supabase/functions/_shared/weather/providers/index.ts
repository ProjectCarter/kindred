import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { NormalizedWeatherForecast, WeatherProvider } from "./types.ts";
import { getCachedWeatherForecast, setCachedWeatherForecast } from "./cache.ts";
import { fetchOpenMeteoForecast, openMeteoWeatherProvider } from "./openMeteo.ts";
import {
  fetchOpenWeatherForecast,
  isOpenWeatherEnabled,
  openWeatherProvider,
} from "./openweather.ts";

export type {
  NormalizedWeatherForecast,
  WeatherProviderId,
  WeatherIntelligence,
  WeatherProvider,
  WeatherAlert,
  WeatherDailyPoint,
  WeatherHourlyPoint,
} from "./types.ts";
export { WEATHER_CACHE_TTL_MINUTES } from "./types.ts";
export {
  buildWeatherIntelligence,
  weatherSourceAttribution,
} from "../intelligence.ts";

export function getWeatherProviders(): WeatherProvider[] {
  const providers: WeatherProvider[] = [];
  if (isOpenWeatherEnabled()) {
    providers.push({ ...openWeatherProvider, enabled: true });
  }
  providers.push(openMeteoWeatherProvider);
  return providers;
}

export function isOpenWeatherConfigured(): boolean {
  return isOpenWeatherEnabled();
}

/**
 * Fetch weather from the first available provider.
 * OpenWeather when OPENWEATHER_API_KEY is set; Open-Meteo fallback.
 */
export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  admin?: SupabaseClient | null
): Promise<NormalizedWeatherForecast | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cached = admin ? await getCachedWeatherForecast(admin, lat, lon) : null;
  if (cached) {
    console.log("[weather] cache hit", {
      provider: cached.provider,
      lat: lat.toFixed(2),
      lon: lon.toFixed(2),
    });
    return cached;
  }

  for (const provider of getWeatherProviders()) {
    if (!provider.enabled) continue;
    const forecast = await provider.fetchForecast(lat, lon);
    if (forecast) {
      console.log("[weather] provider success", {
        provider: provider.id,
        lat: lat.toFixed(2),
        lon: lon.toFixed(2),
        dailyDays: forecast.daily.length,
        alerts: forecast.alerts.length,
        airQuality: Boolean(forecast.airQuality),
      });
      if (admin) {
        await setCachedWeatherForecast(admin, lat, lon, forecast);
      }
      return forecast;
    }
    console.warn("[weather] provider returned null", { provider: provider.id });
  }

  return null;
}

/** Legacy adapter — same shape buildEdition used with inline Open-Meteo. */
export function toLegacyWeatherPayload(
  forecast: NormalizedWeatherForecast | null
): {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
} | null {
  return forecast?.legacy ?? null;
}
