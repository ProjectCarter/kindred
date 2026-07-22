/**
 * Client-side live weather hydration — independent from the prebuilt edition.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KindredPlace } from "../location/types.ts";
import { supabase } from "../supabase.ts";
import type { TemperatureUnit } from "./units.ts";
import {
  isLiveWeatherFresh,
  liveWeatherAgeMinutes,
  liveWeatherRequestKey,
  parseLiveWeatherResponse,
  type LiveWeatherDisplaySource,
  type LiveWeatherResponse,
} from "./liveWeatherTypes.ts";

const CACHE_KEY_PREFIX = "@kindred/live-weather/v3:";

const memoryCache = new Map<string, LiveWeatherResponse>();
const inFlight = new Map<string, Promise<HydrateLiveWeatherResult>>();
let cacheGeneration = 0;

export function liveWeatherCacheGeneration(): number {
  return cacheGeneration;
}

function bumpLiveWeatherCacheGeneration(): void {
  cacheGeneration += 1;
}

export type HydrateLiveWeatherParams = {
  place: KindredPlace;
  metroKey: string;
  unit: TemperatureUnit;
  force?: boolean;
};

export type HydrateLiveWeatherResult = {
  weather: LiveWeatherResponse | null;
  source: LiveWeatherDisplaySource | null;
  fromNetwork: boolean;
  endpointInvoked: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
};

export {
  liveWeatherRequestKey,
  shouldRefreshLiveWeather,
} from "./liveWeatherTypes.ts";

function storageKey(requestKey: string): string {
  return `${CACHE_KEY_PREFIX}${requestKey}`;
}

export function clearLiveWeatherMemoryCache(): void {
  memoryCache.clear();
  inFlight.clear();
  bumpLiveWeatherCacheGeneration();
}

export async function clearLiveWeatherCache(): Promise<void> {
  clearLiveWeatherMemoryCache();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const weatherKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    if (weatherKeys.length > 0) {
      await AsyncStorage.multiRemove(weatherKeys);
    }
  } catch {
    // Best-effort — next hydrate will refetch.
  }
}

async function readClientCache(
  requestKey: string
): Promise<LiveWeatherResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(requestKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { weather?: unknown };
    return parseLiveWeatherResponse(parsed.weather);
  } catch {
    return null;
  }
}

async function writeClientCache(
  requestKey: string,
  weather: LiveWeatherResponse
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storageKey(requestKey),
      JSON.stringify({ weather, savedAt: Date.now() })
    );
  } catch {
    // Non-fatal.
  }
}

function matchesRequest(
  weather: LiveWeatherResponse,
  params: HydrateLiveWeatherParams
): boolean {
  const latOk = Math.abs(weather.latitude - params.place.lat) < 0.02;
  const lonOk = Math.abs(weather.longitude - params.place.lon) < 0.02;
  const metroOk =
    !weather.metroKey || weather.metroKey === params.metroKey.trim();
  return latOk && lonOk && metroOk;
}

async function fetchLiveWeatherFromServer(
  params: HydrateLiveWeatherParams
): Promise<HydrateLiveWeatherResult> {
  const emptyFailure = (
    httpStatus: number | null,
    errorMessage: string | null
  ): HydrateLiveWeatherResult => ({
    weather: null,
    source: null,
    fromNetwork: true,
    endpointInvoked: true,
    httpStatus,
    errorMessage,
  });

  try {
    const { data, error } = await supabase.functions.invoke("live-weather", {
      body: {
        lat: params.place.lat,
        lon: params.place.lon,
        city: params.place.city,
        metroKey: params.metroKey,
        unit: params.unit,
      },
    });

    const httpStatus =
      typeof (error as { context?: { status?: number } } | null)?.context
        ?.status === "number"
        ? (error as { context: { status: number } }).context.status
        : error
          ? 503
          : 200;

    if (error) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[weather:homepage] live fetch error", {
          message: error.message,
          httpStatus,
        });
      }
      return emptyFailure(httpStatus, error.message);
    }

    const body = data as {
      weather?: unknown;
      source?: LiveWeatherDisplaySource;
      error?: string;
    } | null;
    const weather = parseLiveWeatherResponse(body?.weather);
    if (!weather || !matchesRequest(weather, params)) {
      return emptyFailure(
        200,
        body?.error ?? "live_weather_response_invalid"
      );
    }

    const source: LiveWeatherDisplaySource =
      body?.source === "server-cache" ? "server-cache" : "live";

    return {
      weather,
      source,
      fromNetwork: true,
      endpointInvoked: true,
      httpStatus: 200,
      errorMessage: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[weather:homepage] live fetch threw", message);
    }
    return emptyFailure(null, message);
  }
}

export async function hydrateLiveWeather(
  params: HydrateLiveWeatherParams
): Promise<HydrateLiveWeatherResult> {
  const requestKey = liveWeatherRequestKey(
    params.metroKey,
    params.place.lat,
    params.place.lon
  );

  if (!params.force) {
    const memory = memoryCache.get(requestKey);
    if (memory && isLiveWeatherFresh(memory) && matchesRequest(memory, params)) {
      return {
        weather: memory,
        source: "client-cache",
        fromNetwork: false,
        endpointInvoked: false,
        httpStatus: null,
        errorMessage: null,
      };
    }

    const stored = await readClientCache(requestKey);
    if (
      stored &&
      isLiveWeatherFresh(stored) &&
      matchesRequest(stored, params)
    ) {
      memoryCache.set(requestKey, stored);
      return {
        weather: stored,
        source: "client-cache",
        fromNetwork: false,
        endpointInvoked: false,
        httpStatus: null,
        errorMessage: null,
      };
    }
  }

  const pending = inFlight.get(requestKey);
  if (pending) return pending;

  const task = (async (): Promise<HydrateLiveWeatherResult> => {
    const result = await fetchLiveWeatherFromServer(params);
    if (result.weather) {
      memoryCache.set(requestKey, result.weather);
      await writeClientCache(requestKey, result.weather);
    }
    return result;
  })();

  inFlight.set(requestKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(requestKey);
  }
}

export function logHomepageWeatherDiagnostics(input: {
  activeMetro: string | null;
  coordinates: { lat: number; lon: number } | null;
  devOverrideActive?: boolean;
  endpointInvoked?: boolean;
  httpStatus?: number | null;
  source: LiveWeatherDisplaySource | null;
  liveWeather: LiveWeatherResponse | null;
  editionSnapshotTemp: string | null;
  editionSnapshotRetrievedAt: string | null;
  resolvedCurrent: string | null;
  resolvedCondition: string | null;
  resolvedEmoji?: string | null;
  fallbackReason?: string | null;
  weatherVisible?: boolean;
  liveFetchError?: string | null;
}): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  const live = input.liveWeather;
  console.log("[weather:homepage]", {
    activeMetro: input.activeMetro,
    coordinates: input.coordinates,
    devOverrideActive: input.devOverrideActive ?? false,
    endpointInvoked: input.endpointInvoked ?? false,
    httpStatus: input.httpStatus ?? null,
    source: input.source ?? "none",
    currentTemp: input.resolvedCurrent,
    condition: input.resolvedCondition,
    emoji: input.resolvedEmoji ?? null,
    canonicalCondition: live?.canonicalCondition ?? null,
    providerConditionId: live?.providerConditionId ?? null,
    providerMain: live?.providerMain ?? null,
    providerDescription: live?.providerDescription ?? null,
    cloudPercentage: live?.cloudPercentage ?? null,
    mappingSource: live?.mappingSource ?? null,
    observedAt: live?.observedAt ?? null,
    fetchedAt: live?.fetchedAt ?? null,
    ageMinutes: live ? liveWeatherAgeMinutes(live) : null,
    fallbackReason: input.fallbackReason ?? null,
    weatherVisible: input.weatherVisible ?? false,
    liveFetchError: input.liveFetchError ?? null,
    editionSnapshotTemp: input.editionSnapshotTemp,
    editionSnapshotRetrievedAt: input.editionSnapshotRetrievedAt,
  });
}
