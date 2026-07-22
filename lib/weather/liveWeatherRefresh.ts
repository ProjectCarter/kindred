import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { locationPayload, type KindredPlace } from "../location/deviceLocation";
import {
  LIVE_WEATHER_REFRESH_INTERVAL_MS,
} from "./weatherFreshness.ts";
import {
  isValidLiveWeatherSnapshot,
  type LiveWeatherSnapshot,
} from "./liveWeatherSnapshot.ts";
import {
  emptyWeatherRefreshDiagnostic,
  recordWeatherRefreshDiagnostic,
  type WeatherRefreshDiagnostic,
} from "./weatherDiagnostics.ts";

const THROTTLE_KEY = "@kindred/live-weather/last-at";
const SNAPSHOT_KEY = "@kindred/live-weather/snapshot";

const memoryLastAt = new Map<string, number>();
const memorySnapshots = new Map<string, LiveWeatherSnapshot>();

function locationKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

async function readCachedLiveWeather(
  lat: number,
  lon: number
): Promise<LiveWeatherSnapshot | null> {
  const key = locationKey(lat, lon);
  const inMemory = memorySnapshots.get(key);
  if (inMemory && isValidLiveWeatherSnapshot(inMemory)) {
    return inMemory;
  }

  try {
    const raw = await AsyncStorage.getItem(`${SNAPSHOT_KEY}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidLiveWeatherSnapshot(parsed)) return null;
    memorySnapshots.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedLiveWeather(
  lat: number,
  lon: number,
  snapshot: LiveWeatherSnapshot
): Promise<void> {
  const key = locationKey(lat, lon);
  memorySnapshots.set(key, snapshot);
  try {
    await AsyncStorage.setItem(`${SNAPSHOT_KEY}:${key}`, JSON.stringify(snapshot));
  } catch {
    /* non-fatal */
  }
}

/** Hydrate the last successful live observation for this location. */
export async function loadCachedLiveWeather(
  place: KindredPlace | null
): Promise<LiveWeatherSnapshot | null> {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    return null;
  }
  return readCachedLiveWeather(place.lat, place.lon);
}

async function shouldRefresh(lat: number, lon: number): Promise<boolean> {
  const key = locationKey(lat, lon);
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

async function markRefreshed(lat: number, lon: number): Promise<void> {
  const key = locationKey(lat, lon);
  const now = Date.now();
  memoryLastAt.set(key, now);
  try {
    await AsyncStorage.setItem(`${THROTTLE_KEY}:${key}`, String(now));
  } catch {
    /* non-fatal */
  }
}

export type RefreshLiveWeatherOptions = {
  force?: boolean;
};

export async function refreshLiveWeather(
  place: KindredPlace | null,
  options: RefreshLiveWeatherOptions = {}
): Promise<LiveWeatherSnapshot | null> {
  const startedAt = new Date().toISOString();
  const baseDiagnostic: WeatherRefreshDiagnostic = {
    ...emptyWeatherRefreshDiagnostic(),
    status: "started",
    startedAt,
    force: Boolean(options.force),
    coordinates: place
      ? { lat: place.lat, lon: place.lon, city: place.city ?? null }
      : null,
  };

  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    recordWeatherRefreshDiagnostic({
      ...baseDiagnostic,
      status: "empty_response",
      finishedAt: new Date().toISOString(),
      fallbackReason: "missing_coordinates",
      error: "location_required",
    });
    return null;
  }

  if (!options.force && !(await shouldRefresh(place.lat, place.lon))) {
    const cached = await readCachedLiveWeather(place.lat, place.lon);
    recordWeatherRefreshDiagnostic({
      ...baseDiagnostic,
      status: cached ? "success" : "throttled",
      finishedAt: new Date().toISOString(),
      fallbackReason: cached ? "cached_live_weather" : "throttled",
      provider: cached?.provider ?? null,
      retrievedAt: cached?.retrievedAt ?? null,
      fetchTimestamp: cached?.fetchTimestamp ?? null,
      cacheAgeMs: cached?.cacheAgeMs ?? null,
      currentC: cached?.currentC ?? null,
      highC: cached?.highC ?? null,
      lowC: cached?.lowC ?? null,
      conditionCode: cached?.conditionCode ?? null,
      weatherSummary: cached?.weatherSummary ?? null,
    });
    return cached;
  }

  recordWeatherRefreshDiagnostic(baseDiagnostic);

  try {
    const { data, error } = await supabase.functions.invoke("refresh-weather", {
      body: { location: locationPayload(place) },
    });

    if (error) {
      recordWeatherRefreshDiagnostic({
        ...baseDiagnostic,
        status: "invoke_error",
        finishedAt: new Date().toISOString(),
        httpStatus: (error as { status?: number }).status ?? null,
        error: error.message,
        fallbackReason: "invoke_error",
      });
      return null;
    }

    const body = data as {
      ok?: boolean;
      error?: string;
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

    if (body?.error) {
      recordWeatherRefreshDiagnostic({
        ...baseDiagnostic,
        status: "invoke_error",
        finishedAt: new Date().toISOString(),
        error: body.error,
        fallbackReason: "edge_function_error",
      });
      return null;
    }

    const summary = body?.weatherSummary?.trim();
    if (!summary || !body?.retrievedAt) {
      recordWeatherRefreshDiagnostic({
        ...baseDiagnostic,
        status: "empty_response",
        finishedAt: new Date().toISOString(),
        provider: body?.provider ?? null,
        error: "missing_weather_summary",
        fallbackReason: "empty_response",
      });
      return null;
    }

    await markRefreshed(place.lat, place.lon);

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

    await writeCachedLiveWeather(place.lat, place.lon, snapshot);

    recordWeatherRefreshDiagnostic({
      ...baseDiagnostic,
      status: "success",
      finishedAt: new Date().toISOString(),
      provider: snapshot.provider,
      retrievedAt: snapshot.retrievedAt,
      fetchTimestamp: snapshot.fetchTimestamp,
      cacheAgeMs: snapshot.cacheAgeMs ?? null,
      currentC: snapshot.currentC,
      highC: snapshot.highC,
      lowC: snapshot.lowC,
      conditionCode: snapshot.conditionCode,
      weatherSummary: snapshot.weatherSummary,
      coordinates: {
        lat: snapshot.lat,
        lon: snapshot.lon,
        city: place.city ?? null,
      },
    });

    return snapshot;
  } catch (err) {
    recordWeatherRefreshDiagnostic({
      ...baseDiagnostic,
      status: "exception",
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      fallbackReason: "exception",
    });
    return null;
  }
}

export type { LiveWeatherSnapshot } from "./liveWeatherSnapshot.ts";
