/**
 * TEMP(Phase One perf): remove before release.
 *
 * Simulates a true cold newspaper launch while keeping the reader signed in.
 * Clears only on-device newspaper / scroll / recovery caches — never auth,
 * location prefs (home city + mode), or temperature unit. Timezone preference
 * lives on the profile row and is untouched.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAllArticleSessionsAsync } from "../edition/articleSession";
import { clearEditionFreeze } from "../edition/editionFreeze";
import { clearAllHomeScrollSessions } from "../edition/homeSession";
import { resetImageRegistry } from "../edition/imageRegistry";
import { clearAllListScrollSessions } from "../edition/listScrollSession";
import { clearLiveRefreshMemory } from "../edition/liveRefresh";
import { clearTimezoneSyncMemory } from "../edition/timezone";
import { supabase } from "../supabase";
import {
  friendlyCacheKeyLabel,
  isKindredCacheStorageKey,
  isPreservedStorageKey,
  isSupabaseAuthStorageKey,
  KINDRED_EXACT_CACHE_KEYS,
} from "../storage/kindredAsyncStorageKeys";

export type ClearAppCachesResult = {
  removedKeyCount: number;
  removedKeys: string[];
  preservedKeys: string[];
  allKeysFound: string[];
  memoryCachesCleared: string[];
};

const MEMORY_CACHE_LABELS = [
  "edition_freeze",
  "image_registry",
  "home_scroll_memory",
  "list_scroll_memory",
  "article_session_memory",
  "live_refresh_memory",
  "timezone_sync_memory",
] as const;

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys)];
}

/**
 * Drop on-device newspaper caches so the next launch fetches fresh from the
 * network — without signing the reader out.
 */
export async function clearAppCachesForColdLaunch(): Promise<ClearAppCachesResult> {
  const allKeys = (await AsyncStorage.getAllKeys()) ?? [];

  console.log("[perf] AsyncStorage keys before clear:", allKeys);

  const preservedKeys = allKeys.filter(isPreservedStorageKey);
  const scannedKeys = allKeys.filter(isKindredCacheStorageKey);

  const proactiveKeys = [...KINDRED_EXACT_CACHE_KEYS];
  const articleKeys = await clearAllArticleSessionsAsync();

  const removedKeys = uniqueKeys([...scannedKeys, ...proactiveKeys, ...articleKeys]).filter(
    (key) => !isPreservedStorageKey(key)
  );

  if (removedKeys.length > 0) {
    await AsyncStorage.multiRemove(removedKeys);
  }

  clearEditionFreeze();
  resetImageRegistry(null);
  clearAllHomeScrollSessions();
  clearAllListScrollSessions();
  clearLiveRefreshMemory();
  clearTimezoneSyncMemory();

  const memoryCachesCleared = [...MEMORY_CACHE_LABELS] as string[];

  console.log(`[perf] Cleared ${removedKeys.length} cache keys:`);
  for (const key of removedKeys) {
    console.log(`- ${friendlyCacheKeyLabel(key)} (${key})`);
  }
  if (memoryCachesCleared.length > 0) {
    console.log("[perf] Cleared in-memory caches:", memoryCachesCleared);
  }
  console.log("[perf] Preserved keys:", preservedKeys);
  if (allKeys.length === 0) {
    console.warn(
      "[perf] AsyncStorage.getAllKeys() returned no keys — auth may still be intact via proactive clears."
    );
  } else if (removedKeys.length === 0 && allKeys.some(isSupabaseAuthStorageKey)) {
    console.warn(
      "[perf] No Kindred cache keys found in AsyncStorage. Open Home once so edition cache can be written, then retry."
    );
  }

  // Sanity check — session should survive the wipe.
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    console.warn(
      "[perf] Supabase session missing after cache clear — auth keys may use an unexpected format."
    );
  }

  return {
    removedKeyCount: removedKeys.length,
    removedKeys,
    preservedKeys,
    allKeysFound: [...allKeys],
    memoryCachesCleared,
  };
}
