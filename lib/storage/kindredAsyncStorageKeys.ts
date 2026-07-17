/**
 * TEMP(Phase One perf): remove before release.
 *
 * Every AsyncStorage key Kindred owns. Used by the cold-launch dev tool and
 * cache clearing — keeps auth/session keys out of the wipe list.
 */

import {
  LEGACY_DEVICE_LOCATION_KEY,
  LOCATION_PREFS_KEY,
} from "../location/types";

/** Human-readable label for dev tooling and logs. */
export type KindredStorageEntry = {
  label: string;
  /** Exact key or prefix (prefix entries end with `:` or `/`). */
  keyOrPrefix: string;
  /** When true, cold-launch simulation keeps this key. */
  preserve?: boolean;
  source: string;
};

/**
 * Authoritative list of Kindred AsyncStorage keys.
 * Dynamic suffixes are noted in comments on each prefix entry.
 */
export const KINDRED_ASYNC_STORAGE_KEYS: KindredStorageEntry[] = [
  {
    label: "edition_cache",
    keyOrPrefix: "@kindred/edition-cache:",
    source: "lib/edition/editionCache.ts — `{userId}:{editionDate}:{metroKey}`",
  },
  {
    label: "home_scroll_position",
    keyOrPrefix: "@kindred/home-scroll/",
    source: "lib/edition/homeSession.ts — `{editionId}:{locationKey}`",
  },
  {
    label: "list_scroll_position",
    keyOrPrefix: "@kindred/list-scroll/",
    source: "lib/edition/listScrollSession.ts — screen session key",
  },
  {
    label: "article_session",
    keyOrPrefix: "@kindred/article-session/",
    source: "lib/edition/articleSession.ts — article handoff id",
  },
  {
    label: "article_session_index",
    keyOrPrefix: "@kindred/article-session-index",
    source: "lib/edition/articleSession.ts",
  },
  {
    label: "location_prefs",
    keyOrPrefix: LOCATION_PREFS_KEY,
    // Reader city/mode — not newspaper cache. Cold-launch tests must keep it
    // or the location overlay changes load conditions and can omit desks.
    preserve: true,
    source: "lib/location/types.ts",
  },
  {
    label: "location_legacy",
    keyOrPrefix: LEGACY_DEVICE_LOCATION_KEY,
    preserve: true,
    source: "lib/location/types.ts — migrated once",
  },
  {
    label: "live_refresh_throttle",
    keyOrPrefix: "@kindred/live-refresh/last-at:",
    source: "lib/edition/liveRefresh.ts — `{editionId}`",
  },
  {
    label: "dev_edition_override",
    keyOrPrefix: "@kindred/dev/edition-override-v1",
    preserve: true,
    source: "lib/dev/editionOverrideStore.ts",
  },
  {
    label: "dev_pending_generate",
    keyOrPrefix: "@kindred/dev/pending-generate-v1",
    preserve: true,
    source: "lib/dev/pendingDevGenerate.ts",
  },
  {
    label: "timezone_sync",
    keyOrPrefix: "@kindred/timezone/last-synced",
    // Throttle only — IANA timezone lives on profiles.timezone (preserved).
    // Clearing this lets the next launch re-sync without changing preference.
    source: "lib/edition/timezone.ts",
  },
  {
    label: "hero_rotation",
    keyOrPrefix: "kindred.hero.recentImageIds",
    source: "lib/edition/hero/rotation.ts",
  },
  {
    label: "hero_artwork_rotation",
    keyOrPrefix: "kindred.heroArtwork.recentIds",
    source: "lib/edition/heroArtwork/rotation.ts",
  },
  {
    label: "temperature_unit_pref",
    keyOrPrefix: "@kindred/temperature-unit-v1",
    preserve: true,
    source: "lib/weather/units.ts — user setting, not newspaper cache",
  },
];

/** Exact cache keys to proactively remove even if getAllKeys omits them. */
export const KINDRED_EXACT_CACHE_KEYS = KINDRED_ASYNC_STORAGE_KEYS.filter(
  (entry) => !entry.preserve && !entry.keyOrPrefix.endsWith(":") && !entry.keyOrPrefix.endsWith("/")
).map((entry) => entry.keyOrPrefix);

/** Prefixes for dynamic Kindred cache keys discovered via getAllKeys. */
export const KINDRED_CACHE_KEY_PREFIXES = KINDRED_ASYNC_STORAGE_KEYS.filter(
  (entry) => !entry.preserve && (entry.keyOrPrefix.endsWith(":") || entry.keyOrPrefix.endsWith("/"))
).map((entry) => entry.keyOrPrefix);

/** GoTrue / Supabase session storage — never clear during cold-launch tests. */
export function isSupabaseAuthStorageKey(key: string): boolean {
  if (key === "supabase.auth.token") return true;
  // `sb-<project-ref>-auth-token` and PKCE `...-code-verifier` variants.
  if (/^sb-.+-auth-token/.test(key)) return true;
  return false;
}

export function isPreservedStorageKey(key: string): boolean {
  if (isSupabaseAuthStorageKey(key)) return true;
  return KINDRED_ASYNC_STORAGE_KEYS.some(
    (entry) => entry.preserve && entry.keyOrPrefix === key
  );
}

export function isKindredCacheStorageKey(key: string): boolean {
  if (isPreservedStorageKey(key)) return false;
  if (KINDRED_EXACT_CACHE_KEYS.includes(key)) return true;
  return KINDRED_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function friendlyCacheKeyLabel(key: string): string {
  const exact = KINDRED_ASYNC_STORAGE_KEYS.find((e) => e.keyOrPrefix === key);
  if (exact) return exact.label;

  for (const entry of KINDRED_ASYNC_STORAGE_KEYS) {
    if (
      !entry.preserve &&
      (entry.keyOrPrefix.endsWith(":") || entry.keyOrPrefix.endsWith("/")) &&
      key.startsWith(entry.keyOrPrefix)
    ) {
      return entry.label;
    }
  }

  return key;
}
