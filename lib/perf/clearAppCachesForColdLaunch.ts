/**
 * TEMP(Phase One perf): remove before release.
 *
 * Simulates a true cold newspaper launch while keeping the reader signed in.
 * Clears edition cache, scroll state, location prefs, and other app caches —
 * never Supabase auth/session storage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAllArticleSessions } from "../edition/articleSession";
import { clearEditionFreeze } from "../edition/editionFreeze";
import { clearAllHomeScrollSessions } from "../edition/homeSession";
import { resetImageRegistry } from "../edition/imageRegistry";
import { clearAllListScrollSessions } from "../edition/listScrollSession";
import { clearLiveRefreshMemory } from "../edition/liveRefresh";
import { clearTimezoneSyncMemory } from "../edition/timezone";

/** User preference — not newspaper cache; preserved across cold-launch tests. */
const TEMPERATURE_UNIT_KEY = "@kindred/temperature-unit-v1";

/** GoTrue persists sessions under `sb-<project-ref>-auth-token`. */
function isSupabaseAuthStorageKey(key: string): boolean {
  return /^sb-.+-auth-token$/.test(key);
}

/** Keys we intentionally keep — account settings, not newspaper cache. */
const PRESERVED_EXACT_KEYS = new Set([TEMPERATURE_UNIT_KEY]);

function shouldClearAppCacheKey(key: string): boolean {
  if (isSupabaseAuthStorageKey(key)) return false;
  if (PRESERVED_EXACT_KEYS.has(key)) return false;
  if (key.startsWith("@kindred/")) return true;
  if (key.startsWith("kindred.")) return true;
  return false;
}

export type ClearAppCachesResult = {
  removedKeyCount: number;
  removedKeys: string[];
};

/**
 * Drop on-device newspaper caches so the next launch fetches fresh from the
 * network — without signing the reader out.
 */
export async function clearAppCachesForColdLaunch(): Promise<ClearAppCachesResult> {
  const allKeys = await AsyncStorage.getAllKeys();
  const removedKeys = allKeys.filter(shouldClearAppCacheKey);

  if (removedKeys.length > 0) {
    await AsyncStorage.multiRemove(removedKeys);
  }

  clearEditionFreeze();
  resetImageRegistry(null);
  clearAllHomeScrollSessions();
  clearAllListScrollSessions();
  clearAllArticleSessions();
  clearLiveRefreshMemory();
  clearTimezoneSyncMemory();

  if (__DEV__) {
    console.log("[perf] clearAppCachesForColdLaunch", {
      removedKeyCount: removedKeys.length,
      removedKeys,
      preservedAuth: allKeys.filter(isSupabaseAuthStorageKey),
    });
  }

  return { removedKeyCount: removedKeys.length, removedKeys };
}
