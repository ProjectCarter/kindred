import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { locationPayload, type KindredPlace } from "../location/deviceLocation";
import {
  LIVE_WEATHER_REFRESH_INTERVAL_MS,
  type WeatherFreshnessMetadata,
} from "./weatherFreshness.ts";

const THROTTLE_KEY = "@kindred/live-weather/last-at";

export type LiveWeatherSnapshot = WeatherFreshnessMetadata & {
  weatherSummary: string;
  conditionCode: number | null;
  currentC: number | null;
  highC: number | null;
  lowC: number | null;
};

const memoryLastAt = new Map<string, number>();

function throttleKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

async function shouldRefresh(lat: number, lon: number): Promise<boolean> {
  const key = throttleKey(lat, lon);
  const now = Date.now();
  const inMemory = memoryLastAt.get(key);
  if (inMemory && now - inMemory < LIVE_WEATHER_REFRESH_INTERVAL_MS) {
    return false;
  }
  try {
    const stored = await AsyncStorage.getItem(`${THROTTLE_KEY}:${key}`);
    if (stored) {
      const at = Number(stored);
      if (Number.isFinite(at) && now - at < LIVE_WEATHER_REFRESH_INTERVAL_MS) {
        memoryLastAt.set(key, at);
        return false;
      }
    }
  } catch {
    /* proceed */
  }
  return true;
}

function markRefreshed(lat: number, lon: number): void {
  const key = throttleKey(lat, lon);
  const now = Date.now();
  memoryLastAt.set(key, now);
  void AsyncStorage.setItem(`${THROTTLE_KEY}:${key}`, String(now)).catch(
    () => {}
  );
}

export async function refreshLiveWeather(
  place: KindredPlace | null
): Promise<LiveWeatherSnapshot | null> {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    return null;
  }
  if (!(await shouldRefresh(place.lat, place.lon))) {
    return null;
  }
  markRefreshed(place.lat, place.lon);

  try {
    const { data, error } = await supabase.functions.invoke("refresh-weather", {
      body: { location: locationPayload(place) },
    });
    if (error) {
      if (__DEV__) console.warn("[liveWeather] invoke error", error.message);
      return null;
    }
    const body = data as {
      weatherSummary?: string;
      retrievedAt?: string;
      fetchTimestamp?: string;
      provider?: string;
      lat?: number;
      lon?: number;
      conditionCode?: number | null;
      currentC?: number | null;
      highC?: number | null;
      lowC?: number | null;
      cacheAgeMs?: number | null;
    } | null;
    const summary = body?.weatherSummary?.trim();
    if (!summary || !body?.retrievedAt) return null;

    const snapshot: LiveWeatherSnapshot = {
      weatherSummary: summary,
      retrievedAt: body.retrievedAt,
      fetchTimestamp: body.fetchTimestamp ?? new Date().toISOString(),
      provider: body.provider ?? "unknown",
      lat: body.lat ?? place.lat,
      lon: body.lon ?? place.lon,
      conditionCode:
        typeof body.conditionCode === "number" ? body.conditionCode : null,
      currentC: typeof body.currentC === "number" ? body.currentC : null,
      highC: typeof body.highC === "number" ? body.highC : null,
      lowC: typeof body.lowC === "number" ? body.lowC : null,
      cacheAgeMs: body.cacheAgeMs ?? null,
    };

    if (__DEV__) {
      console.log("[liveWeather:debug]", {
        provider: snapshot.provider,
        retrievedAt: snapshot.retrievedAt,
        fetchTimestamp: snapshot.fetchTimestamp,
        coordinates: { lat: snapshot.lat, lon: snapshot.lon },
        cacheAgeMs: snapshot.cacheAgeMs,
        currentC: snapshot.currentC,
        highC: snapshot.highC,
        lowC: snapshot.lowC,
        conditionCode: snapshot.conditionCode,
        weatherSummary: snapshot.weatherSummary,
      });
    }

    return snapshot;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[liveWeather] threw",
        err instanceof Error ? err.message : String(err)
      );
    }
    return null;
  }
}
