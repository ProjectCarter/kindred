/**
 * Device location for Kindred’s local paper.
 *
 * Priority:
 * 1) GPS + reverse geocode (when permission granted)
 * 2) Last saved profile / AsyncStorage cache
 * 3) FALLBACK_LOCATION_WHEN_PERMISSION_DENIED — only if permission is denied
 *
 * Edition generation (weather, local news, local events, discovery) must
 * receive this resolved location — never a silent San Francisco default.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { supabase, isSupabaseConfigured } from "../supabase";

const CACHE_KEY = "@kindred/device-location";

/**
 * LAST RESORT when the reader declines location permission (or GPS fails).
 * Change this single object for demos / staging — nowhere else.
 * Do NOT use San Francisco here unless you intentionally want that city.
 */
export const FALLBACK_LOCATION_WHEN_PERMISSION_DENIED = {
  city: "Phoenix",
  region: "Arizona",
  state: "AZ",
  lat: 33.4484,
  lon: -112.074,
} as const;

export type DeviceLocation = {
  city: string;
  region: string | null;
  state: string | null;
  lat: number;
  lon: number;
  /** How this location was obtained. */
  source: "gps" | "cache" | "profile" | "fallback";
};

function isUsableCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const t = city.trim();
  return t.length > 0 && t.toLowerCase() !== "your area";
}

async function readCache(): Promise<DeviceLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceLocation;
    if (!parsed?.lat || !parsed?.lon || !isUsableCity(parsed.city)) return null;
    return { ...parsed, source: "cache" };
  } catch {
    return null;
  }
}

async function writeCache(loc: DeviceLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(loc));
  } catch {
    /* best-effort */
  }
}

async function readProfileLocation(): Promise<DeviceLocation | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("location")
      .eq("id", user.id)
      .maybeSingle();
    const loc = data?.location as {
      city?: string | null;
      region?: string | null;
      state?: string | null;
      lat?: number | null;
      lon?: number | null;
    } | null;
    if (
      loc?.lat == null ||
      loc?.lon == null ||
      !isUsableCity(loc.city ?? null)
    ) {
      return null;
    }
    return {
      city: loc.city!.trim(),
      region: loc.region ?? null,
      state: loc.state ?? null,
      lat: loc.lat,
      lon: loc.lon,
      source: "profile",
    };
  } catch {
    return null;
  }
}

export async function persistLocationToProfile(
  loc: DeviceLocation
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        location: {
          city: loc.city,
          region: loc.region,
          state: loc.state,
          lat: loc.lat,
          lon: loc.lon,
        },
      })
      .eq("id", user.id);
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[location] persist failed",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

/**
 * Request permission (first launch), read GPS, reverse-geocode to city.
 * Persists to AsyncStorage + profiles.location for overnight editions.
 */
export async function resolveDeviceLocation(): Promise<DeviceLocation> {
  const cached = await readCache();
  const profiled = cached ? null : await readProfileLocation();

  try {
    const existing = await Location.getForegroundPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
    }

    if (status !== "granted") {
      // Permission denied — use explicit, easy-to-change fallback.
      const fallback: DeviceLocation = {
        ...FALLBACK_LOCATION_WHEN_PERMISSION_DENIED,
        source: "fallback",
      };
      await writeCache(fallback);
      void persistLocationToProfile(fallback);
      if (__DEV__) {
        console.warn(
          "[location] permission denied — using FALLBACK_LOCATION_WHEN_PERMISSION_DENIED",
          fallback.city
        );
      }
      return fallback;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = position.coords;
    const places = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    const place = places[0];
    const city =
      place?.city?.trim() ||
      place?.subregion?.trim() ||
      place?.district?.trim() ||
      "";

    if (!isUsableCity(city)) {
      // GPS worked but geocode failed — keep coords, prefer prior city label.
      const prior = cached ?? profiled;
      const resolved: DeviceLocation = {
        city: prior?.city ?? FALLBACK_LOCATION_WHEN_PERMISSION_DENIED.city,
        region:
          place?.region?.trim() ||
          prior?.region ||
          FALLBACK_LOCATION_WHEN_PERMISSION_DENIED.region,
        state:
          place?.isoCountryCode && place?.region
            ? place.region
            : prior?.state ?? FALLBACK_LOCATION_WHEN_PERMISSION_DENIED.state,
        lat: latitude,
        lon: longitude,
        source: "gps",
      };
      await writeCache(resolved);
      void persistLocationToProfile(resolved);
      return resolved;
    }

    const resolved: DeviceLocation = {
      city,
      region: place?.region?.trim() || place?.subregion?.trim() || null,
      state: place?.region?.trim() || null,
      lat: latitude,
      lon: longitude,
      source: "gps",
    };

    await writeCache(resolved);
    void persistLocationToProfile(resolved);
    if (__DEV__) {
      console.log("[location] resolved via GPS", {
        city: resolved.city,
        region: resolved.region,
        lat: resolved.lat,
        lon: resolved.lon,
      });
    }
    return resolved;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[location] GPS failed",
        err instanceof Error ? err.message : String(err)
      );
    }
    if (cached) return cached;
    if (profiled) {
      await writeCache(profiled);
      return profiled;
    }
    const fallback: DeviceLocation = {
      ...FALLBACK_LOCATION_WHEN_PERMISSION_DENIED,
      source: "fallback",
    };
    await writeCache(fallback);
    void persistLocationToProfile(fallback);
    return fallback;
  }
}

/** Payload shape accepted by generate-edition / buildEdition. */
export function locationPayload(loc: DeviceLocation) {
  return {
    city: loc.city,
    region: loc.region,
    state: loc.state,
    lat: loc.lat,
    lon: loc.lon,
  };
}
