/**
 * Kindred location service — single source of truth.
 *
 * Used by Local News, Local Events, Weather, Recommendations, Discovery,
 * city labels, and future place-based features.
 *
 * Privacy: foreground GPS only. Never background tracking.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { supabase, isSupabaseConfigured } from "../supabase";
import { filterSuggestedCities, SUGGESTED_CITIES } from "./cities";
import { recordLoadPrefsInvocation } from "../perf/startupMetrics";
import type {
  ActiveLocation,
  KindredPlace,
  LocationMode,
  LocationPrefs,
} from "./types";
import {
  CURRENT_LOCATION_STALE_MS,
  LEGACY_DEVICE_LOCATION_KEY,
  LOCATION_PREFS_KEY,
} from "./types";

const DEFAULT_PREFS: LocationPrefs = {
  mode: "home",
  home: null,
  travel: null,
  current: null,
  currentUpdatedAt: null,
  firstRunCompleted: false,
};

/** Coalesce concurrent loadPrefs during launch — invalidated on write. */
let launchPrefsPromise: Promise<LocationPrefs> | null = null;

export function invalidateLaunchPrefsCache(): void {
  launchPrefsPromise = null;
}

function isUsableCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const t = city.trim();
  return t.length > 0 && t.toLowerCase() !== "your area";
}

function placeFromUnknown(raw: unknown): KindredPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const lat = typeof o.lat === "number" ? o.lat : null;
  const lon = typeof o.lon === "number" ? o.lon : null;
  if (!isUsableCity(city) || lat == null || lon == null) return null;
  return {
    city,
    region: typeof o.region === "string" ? o.region : null,
    state: typeof o.state === "string" ? o.state : null,
    lat,
    lon,
  };
}

function modeLabel(mode: LocationMode, isTravel: boolean): string {
  if (isTravel) return "Travel Edition";
  if (mode === "current") return "Current Location";
  return "Home City";
}

function toActive(prefs: LocationPrefs): ActiveLocation {
  if (prefs.mode === "travel" && prefs.travel) {
    return {
      place: prefs.travel,
      mode: "travel",
      modeLabel: modeLabel("travel", true),
      isTravel: true,
      needsSetup: false,
    };
  }
  if (prefs.mode === "current" && prefs.current) {
    return {
      place: prefs.current,
      mode: "current",
      modeLabel: modeLabel("current", false),
      isTravel: false,
      needsSetup: false,
    };
  }
  // Current/travel requested but missing → home if available
  if (prefs.home) {
    return {
      place: prefs.home,
      mode: "home",
      modeLabel: modeLabel("home", false),
      isTravel: false,
      needsSetup: false,
    };
  }
  if (prefs.current) {
    return {
      place: prefs.current,
      mode: "current",
      modeLabel: modeLabel("current", false),
      isTravel: false,
      needsSetup: false,
    };
  }
  return {
    place: null,
    mode: prefs.mode,
    modeLabel: modeLabel(prefs.mode, false),
    isTravel: false,
    needsSetup: true,
  };
}

async function readPrefsRaw(): Promise<LocationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<LocationPrefs>;
    return {
      mode:
        parsed.mode === "current" ||
        parsed.mode === "home" ||
        parsed.mode === "travel"
          ? parsed.mode
          : "home",
      home: placeFromUnknown(parsed.home),
      travel: placeFromUnknown(parsed.travel),
      current: placeFromUnknown(parsed.current),
      currentUpdatedAt:
        typeof parsed.currentUpdatedAt === "number"
          ? parsed.currentUpdatedAt
          : null,
      firstRunCompleted: Boolean(parsed.firstRunCompleted),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function writePrefs(prefs: LocationPrefs): Promise<void> {
  invalidateLaunchPrefsCache();
  try {
    await AsyncStorage.setItem(LOCATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

async function migrateLegacyCache(prefs: LocationPrefs): Promise<LocationPrefs> {
  if (prefs.home || prefs.current || prefs.travel) return prefs;
  try {
    const raw = await AsyncStorage.getItem(LEGACY_DEVICE_LOCATION_KEY);
    if (!raw) return prefs;
    const legacy = placeFromUnknown(JSON.parse(raw));
    if (!legacy) return prefs;
    // Old Phoenix fallback cache — do not treat as a chosen home city.
    const isPhoenixFallback =
      legacy.city.toLowerCase() === "phoenix" &&
      Math.abs(legacy.lat - 33.4484) < 0.01 &&
      Math.abs(legacy.lon - -112.074) < 0.01;
    if (isPhoenixFallback) {
      await AsyncStorage.removeItem(LEGACY_DEVICE_LOCATION_KEY);
      return prefs;
    }
    const next: LocationPrefs = {
      ...prefs,
      current: legacy,
      home: legacy,
      mode: "home",
      currentUpdatedAt: Date.now(),
    };
    await writePrefs(next);
    await AsyncStorage.removeItem(LEGACY_DEVICE_LOCATION_KEY);
    return next;
  } catch {
    return prefs;
  }
}

async function syncProfile(prefs: LocationPrefs, active: KindredPlace | null) {
  if (!isSupabaseConfigured) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const patch: Record<string, unknown> = {};
    if (active) {
      patch.location = {
        city: active.city,
        region: active.region,
        state: active.state,
        lat: active.lat,
        lon: active.lon,
      };
    }
    if (prefs.home) {
      patch.home_location = {
        city: prefs.home.city,
        region: prefs.home.region,
        state: prefs.home.state,
        lat: prefs.home.lat,
        lon: prefs.home.lon,
      };
    }
    if (prefs.mode === "travel" && prefs.travel) {
      patch.travel = {
        away: true,
        city: prefs.travel.city,
        region: prefs.travel.region,
        state: prefs.travel.state,
        lat: prefs.travel.lat,
        lon: prefs.travel.lon,
        note: null,
        until: null,
      };
    } else {
      patch.travel = { away: false, city: null, note: null, until: null };
    }

    await supabase.from("profiles").update(patch).eq("id", user.id);
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[location] profile sync failed",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

/**
 * If local prefs were wiped but the profile still has a home/current city,
 * restore them so cold-launch tests and reinstalls don't force onboarding
 * or drop discovery desks that depend on reader coordinates.
 */
async function hydratePrefsFromProfile(
  prefs: LocationPrefs
): Promise<LocationPrefs> {
  if (prefs.home || prefs.current || prefs.travel) return prefs;
  if (!isSupabaseConfigured) return prefs;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return prefs;

    const { data, error } = await supabase
      .from("profiles")
      .select("home_location, location, travel")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) return prefs;

    const home =
      placeFromUnknown(data.home_location) ?? placeFromUnknown(data.location);
    const current = placeFromUnknown(data.location);
    const travelRaw =
      data.travel && typeof data.travel === "object"
        ? (data.travel as Record<string, unknown>)
        : null;
    const travel =
      travelRaw?.away === true
        ? placeFromUnknown({
            city: travelRaw.city,
            region: travelRaw.region,
            state: travelRaw.state,
            lat: travelRaw.lat,
            lon: travelRaw.lon,
          })
        : null;

    if (!home && !current && !travel) return prefs;

    const next: LocationPrefs = {
      mode: travel ? "travel" : home ? "home" : "current",
      home: home ?? current,
      travel,
      current: current ?? home,
      currentUpdatedAt: current ? Date.now() : prefs.currentUpdatedAt,
      firstRunCompleted: true,
    };
    await writePrefs(next);
    if (__DEV__) {
      console.log("[location] hydrated prefs from profile", {
        mode: next.mode,
        city: (next.home ?? next.current ?? next.travel)?.city ?? null,
      });
    }
    return next;
  } catch {
    return prefs;
  }
}

async function loadPrefs(): Promise<LocationPrefs> {
  if (launchPrefsPromise) {
    recordLoadPrefsInvocation(true);
    return launchPrefsPromise;
  }

  recordLoadPrefsInvocation(false);
  launchPrefsPromise = (async () => {
    const base = await readPrefsRaw();
    const migrated = await migrateLegacyCache(base);
    return hydratePrefsFromProfile(migrated);
  })();

  try {
    return await launchPrefsPromise;
  } catch (err) {
    invalidateLaunchPrefsCache();
    throw err;
  }
}

/** Payload for generate-edition / buildEdition. */
export function locationPayload(place: KindredPlace) {
  return {
    city: place.city,
    region: place.region,
    state: place.state,
    lat: place.lat,
    lon: place.lon,
  };
}

export async function getLocationPrefs(): Promise<LocationPrefs> {
  return loadPrefs();
}

export async function getActiveLocation(): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  return toActive(prefs);
}

/** getCurrentPositionAsync has no built-in timeout — a weak/absent GPS fix
 * can otherwise hang far longer than any caller's own timeout, silently
 * stalling everything awaiting it (e.g. edition generation). */
const GPS_FIX_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Read GPS once (foreground). Does not change mode unless `setModeCurrent`.
 */
export async function fetchCurrentGpsPlace(): Promise<{
  place: KindredPlace | null;
  permission: "granted" | "denied" | "undetermined";
  error?: string;
}> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
    }

    if (status !== "granted") {
      return { place: null, permission: "denied" };
    }

    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      GPS_FIX_TIMEOUT_MS,
      "GPS fix timed out"
    );
    const { latitude, longitude } = position.coords;
    const places = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    const geo = places[0];
    const city =
      geo?.city?.trim() ||
      geo?.subregion?.trim() ||
      geo?.district?.trim() ||
      "";

    if (!isUsableCity(city)) {
      return {
        place: null,
        permission: "granted",
        error: "Couldn’t name this place. Choose a city instead.",
      };
    }

    return {
      place: {
        city,
        region: geo?.region?.trim() || geo?.subregion?.trim() || null,
        state: geo?.region?.trim() || null,
        lat: latitude,
        lon: longitude,
      },
      permission: "granted",
    };
  } catch (err) {
    return {
      place: null,
      permission: "granted",
      error: err instanceof Error ? err.message : "Location unavailable",
    };
  }
}

export async function setModeCurrent(options?: {
  forceRefresh?: boolean;
}): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  const stale =
    !prefs.current ||
    !prefs.currentUpdatedAt ||
    Date.now() - prefs.currentUpdatedAt > CURRENT_LOCATION_STALE_MS;

  if (!options?.forceRefresh && prefs.current && !stale) {
    const next: LocationPrefs = { ...prefs, mode: "current" };
    await writePrefs(next);
    const active = toActive(next);
    void syncProfile(next, active.place);
    return active;
  }

  const gps = await fetchCurrentGpsPlace();
  if (!gps.place) {
    // Stay needing setup or keep prior mode if home exists
    if (prefs.home) {
      const next: LocationPrefs = { ...prefs, mode: "home" };
      await writePrefs(next);
      return toActive(next);
    }
    return toActive(prefs);
  }

  const next: LocationPrefs = {
    ...prefs,
    mode: "current",
    current: gps.place,
    currentUpdatedAt: Date.now(),
    // Seed home if never chosen
    home: prefs.home ?? gps.place,
  };
  await writePrefs(next);
  const active = toActive(next);
  void syncProfile(next, active.place);
  if (__DEV__) {
    console.log("[location] current GPS", gps.place.city);
  }
  return active;
}

export async function setHomeCity(place: KindredPlace): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  const next: LocationPrefs = {
    ...prefs,
    home: place,
    mode: prefs.mode === "travel" && prefs.travel ? "travel" : "home",
    firstRunCompleted: true,
  };
  // If not traveling, use home as active mode
  if (next.mode !== "travel") next.mode = "home";
  await writePrefs(next);
  const active = toActive(next);
  void syncProfile(next, active.place);
  return active;
}

export async function setTravelCity(place: KindredPlace): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  const next: LocationPrefs = {
    ...prefs,
    travel: place,
    mode: "travel",
    firstRunCompleted: true,
  };
  await writePrefs(next);
  const active = toActive(next);
  void syncProfile(next, active.place);
  return active;
}

export async function clearTravelLocation(): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  const next: LocationPrefs = {
    ...prefs,
    travel: null,
    mode: prefs.current ? "current" : "home",
  };
  await writePrefs(next);
  const active = toActive(next);
  void syncProfile(next, active.place);
  return active;
}

export async function returnToHomeCity(): Promise<ActiveLocation> {
  const prefs = await loadPrefs();
  const next: LocationPrefs = {
    ...prefs,
    travel: null,
    mode: "home",
  };
  await writePrefs(next);
  const active = toActive(next);
  void syncProfile(next, active.place);
  return active;
}

export async function markFirstRunCompleted(): Promise<void> {
  const prefs = await loadPrefs();
  await writePrefs({ ...prefs, firstRunCompleted: true });
}

export async function isFirstRunPending(): Promise<boolean> {
  const prefs = await loadPrefs();
  return !prefs.firstRunCompleted;
}

/**
 * Resolve the place used for edition generation.
 * Refreshes GPS when mode is current and the fix is stale.
 * Returns null when the reader must choose a city (no silent default).
 */
export async function resolveActivePlace(options?: {
  refreshIfStale?: boolean;
}): Promise<ActiveLocation> {
  let prefs = await loadPrefs();
  const refresh = options?.refreshIfStale !== false;

  if (prefs.mode === "current" && refresh) {
    const stale =
      !prefs.current ||
      !prefs.currentUpdatedAt ||
      Date.now() - prefs.currentUpdatedAt > CURRENT_LOCATION_STALE_MS;
    if (stale) {
      const gps = await fetchCurrentGpsPlace();
      if (gps.place) {
        prefs = {
          ...prefs,
          current: gps.place,
          currentUpdatedAt: Date.now(),
          home: prefs.home ?? gps.place,
        };
        await writePrefs(prefs);
      } else if (!prefs.current && prefs.home) {
        prefs = { ...prefs, mode: "home" };
        await writePrefs(prefs);
      }
    }
  }

  const active = toActive(prefs);
  if (active.place) void syncProfile(prefs, active.place);
  if (__DEV__) {
    console.log("[location] resolveActivePlace", {
      mode: active.mode,
      modeLabel: active.modeLabel,
      city: active.place?.city ?? null,
      region: active.place?.region ?? null,
      state: active.place?.state ?? null,
      lat: active.place?.lat ?? null,
      lon: active.place?.lon ?? null,
      needsSetup: active.needsSetup,
      isTravel: active.isTravel,
    });
  }
  return active;
}

/** City search: curated list + optional geocode for free-text. */
export async function searchCities(query: string): Promise<KindredPlace[]> {
  const suggested = filterSuggestedCities(query);
  const q = query.trim();
  if (q.length < 2) return suggested;

  // Prefer exact curated matches first
  const exact = SUGGESTED_CITIES.find(
    (c) => c.city.toLowerCase() === q.toLowerCase()
  );
  if (exact) {
    return [exact, ...suggested.filter((c) => c.city !== exact.city)];
  }

  try {
    const results = await Location.geocodeAsync(q);
    const places: KindredPlace[] = [];
    for (const r of results.slice(0, 5)) {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: r.latitude,
        longitude: r.longitude,
      });
      const geo = reverse[0];
      const city =
        geo?.city?.trim() ||
        geo?.subregion?.trim() ||
        q;
      if (!isUsableCity(city)) continue;
      places.push({
        city,
        region: geo?.region?.trim() || null,
        state: geo?.region?.trim() || null,
        lat: r.latitude,
        lon: r.longitude,
      });
    }
    // Dedupe by city name
    const seen = new Set(suggested.map((s) => s.city.toLowerCase()));
    for (const p of places) {
      if (!seen.has(p.city.toLowerCase())) {
        suggested.push(p);
        seen.add(p.city.toLowerCase());
      }
    }
  } catch {
    /* curated list is enough */
  }

  return suggested.slice(0, 12);
}

// ── Compatibility aliases (older callers) ─────────────────────────────

/** @deprecated Use KindredPlace via getActiveLocation / resolveActivePlace */
export type DeviceLocation = KindredPlace & {
  source: "gps" | "cache" | "profile" | "fallback" | "home" | "travel";
};

/**
 * Resolve location for edition generation.
 * Never returns a silent Phoenix/SF default — returns null place via needsSetup.
 */
export async function resolveDeviceLocation(): Promise<DeviceLocation | null> {
  const active = await resolveActivePlace({ refreshIfStale: true });
  if (!active.place) return null;
  return {
    ...active.place,
    source:
      active.mode === "travel"
        ? "travel"
        : active.mode === "home"
          ? "home"
          : "gps",
  };
}

export async function persistLocationToProfile(
  loc: KindredPlace
): Promise<void> {
  const prefs = await loadPrefs();
  void syncProfile(prefs, loc);
}
