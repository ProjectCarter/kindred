/**
 * Local edition cache — show today's paper immediately on cold start while
 * the network catches up. A printed newspaper should never leave the reader
 * staring at a loading screen for minutes when yesterday's bundle is still
 * on the shelf.
 *
 * Cache keys include market identity (`metroKey`) so Gilbert and San Diego
 * editions for the same calendar day never collide.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EditionSection } from "./types";
import type { LeadStory } from "./LeadStory";
import type { TopStoryItem } from "./topStories";
import type { NationalNewsPackage } from "./nationalNews";
import type { BanditPayload } from "./bandit";
import type { EditionIntelligence } from "./surfaceIntelligence";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { parseMorningHeroExperience } from "./morningEdition";
import { mergeMorningHeroIntoCachedBundle } from "./resolveMorningHero";
import { resolveNationalNewsForCachedBundle } from "./homepageNewsHydration.ts";
import type { UsNationalDailyRecord } from "./usNationalDaily";
import {
  articleIdentityFromSection,
  imageIdentityFromAsset,
  logTodayInHistorySyncTrace,
} from "./todayInHistorySync";
import { todayInHistoryImageFromNationalDaily } from "./todayInHistoryImage";
import {
  recordEditionCacheDiskHit,
  recordEditionCacheMemoryHit,
  recordEditionCacheMiss,
  recordEditionCacheParse,
} from "../perf/startupMetrics";
import {
  masterpieceTraceAsync,
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "./masterpieceDiagnostics";

const CACHE_KEY_PREFIX = "@kindred/edition-cache:v2:";
/** Bump when morning hero article sanitization changes — invalidates stale detail on disk. */
export const EDITION_CACHE_ARTICLE_VERSION = 2;

export type CachedEditionBundle = {
  userId: string;
  editionId: string;
  editionDate: string;
  /** Market-scoped cache identity — must match active reader location. */
  metroKey: string;
  cachedAt: number;
  /** Bumped when masterpiece article payload normalization changes. */
  morningHeroArticleVersion?: number;
  sections: EditionSection[];
  leadStory: LeadStory | null;
  topStories: TopStoryItem[];
  /** Shared U.S. national news — optional for legacy cached bundles. */
  nationalNews?: NationalNewsPackage | null;
  bandit: BanditPayload | null;
  intelligence: EditionIntelligence | null;
  /** Frozen hero selection — stable for the life of this edition. */
  heroImageId?: string | null;
  /** Frozen daily artwork hero from morning_edition.morningHero. */
  morningHero?: MorningHeroExperience | null;
  /** Paired Today in History snapshot — keeps article + image on one record in cache. */
  pairedNationalDaily?: UsNationalDailyRecord | null;
};

function cacheKey(userId: string, editionDate: string, metroKey: string): string {
  return `${CACHE_KEY_PREFIX}${userId}:${editionDate}:${metroKey}`;
}

function legacyCacheKey(userId: string, editionDate: string): string {
  return `${CACHE_KEY_PREFIX}${userId}:${editionDate}`;
}

function memoryKey(userId: string, editionDate: string, metroKey: string): string {
  return `${userId}:${editionDate}:${metroKey}`;
}

/** In-process warm cache — instant on warm relaunch within the same JS session. */
const memoryBundles = new Map<string, CachedEditionBundle>();

/** Coalesce concurrent disk reads for the same edition key. */
const inflightLoads = new Map<string, Promise<CachedEditionBundle | null>>();

function normalizeCachedBundle(
  parsed: CachedEditionBundle,
  userId: string,
  editionDate: string,
  metroKey: string
): CachedEditionBundle | null {
  if (
    !parsed ||
    parsed.userId !== userId ||
    parsed.editionDate !== editionDate ||
    !Array.isArray(parsed.sections)
  ) {
    return null;
  }
  if (parsed.metroKey && parsed.metroKey !== metroKey) {
    return null;
  }
  if (parsed.morningHero) {
    parsed.morningHero =
      parseMorningHeroExperience(parsed.morningHero) ?? parsed.morningHero;
  }
  if (parsed.intelligence?.morningHero) {
    parsed.intelligence = {
      ...parsed.intelligence,
      morningHero:
        parseMorningHeroExperience(parsed.intelligence.morningHero) ??
        parsed.intelligence.morningHero,
    };
  }
  if (
    (parsed.morningHeroArticleVersion ?? 0) < EDITION_CACHE_ARTICLE_VERSION
  ) {
    parsed.morningHero =
      parseMorningHeroExperience(parsed.morningHero) ??
      parseMorningHeroExperience(parsed.intelligence?.morningHero) ??
      parsed.morningHero;
    parsed.intelligence = parsed.intelligence
      ? {
          ...parsed.intelligence,
          morningHero:
            parseMorningHeroExperience(parsed.intelligence.morningHero) ??
            parsed.intelligence.morningHero,
        }
      : parsed.intelligence;
  }
  parsed.metroKey = metroKey;
  parsed.morningHeroArticleVersion = EDITION_CACHE_ARTICLE_VERSION;
  if (!parsed.nationalNews) {
    parsed.nationalNews = resolveNationalNewsForCachedBundle(parsed);
  }
  return mergeMorningHeroIntoCachedBundle(parsed);
}

function traceCachedTodayInHistory(
  step: "async_storage",
  bundle: CachedEditionBundle
): void {
  const section = bundle.sections.find((s) => s.section_type === "today_in_history");
  if (!section) return;

  const article = articleIdentityFromSection(section);
  const pairedImage = todayInHistoryImageFromNationalDaily(bundle.pairedNationalDaily);
  logTodayInHistorySyncTrace({
    step,
    editionId: bundle.editionId,
    editionDate: bundle.editionDate,
    usNationalDailyId: bundle.pairedNationalDaily?.id ?? null,
    cachedAt: bundle.cachedAt,
    article,
    image: imageIdentityFromAsset(pairedImage, {
      source: pairedImage ? "paired_cache" : null,
      nationalDailyId: bundle.pairedNationalDaily?.id ?? null,
      year: bundle.pairedNationalDaily?.todayInHistory?.year ?? null,
    }),
    synced: Boolean(
      pairedImage &&
        bundle.pairedNationalDaily?.todayInHistory?.headline?.trim() ===
          section.headline?.trim()
    ),
    reason: bundle.pairedNationalDaily ? null : "cache_missing_paired_national_daily",
  });
}

/** Synchronous warm-cache read — no AsyncStorage, no JSON parse. */
export function peekMemoryCachedEdition(
  userId: string,
  editionDate: string,
  metroKey: string
): CachedEditionBundle | null {
  return memoryBundles.get(memoryKey(userId, editionDate, metroKey)) ?? null;
}

export async function loadCachedEdition(
  userId: string,
  editionDate: string,
  metroKey: string
): Promise<CachedEditionBundle | null> {
  const warm = peekMemoryCachedEdition(userId, editionDate, metroKey);
  if (warm) {
    recordEditionCacheMemoryHit();
    return warm;
  }

  const key = cacheKey(userId, editionDate, metroKey);
  const inflight = inflightLoads.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    masterpieceTraceBegin("article/cache-load", { userId, editionDate, metroKey });
    const started = Date.now();
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        recordEditionCacheMiss();
        masterpieceTraceEnd("article/cache-load", {
          ms: Date.now() - started,
          hit: false,
        });
        return null;
      }
      recordEditionCacheParse();
      recordEditionCacheDiskHit();
      const parsed = normalizeCachedBundle(
        JSON.parse(raw) as CachedEditionBundle,
        userId,
        editionDate,
        metroKey
      );
      if (parsed) {
        memoryBundles.set(memoryKey(userId, editionDate, metroKey), parsed);
        traceCachedTodayInHistory("async_storage", parsed);
      }
      masterpieceTraceEnd("article/cache-load", {
        ms: Date.now() - started,
        hit: Boolean(parsed),
      });
      return parsed;
    } catch {
      recordEditionCacheMiss();
      masterpieceTraceEnd("article/cache-load", {
        ms: Date.now() - started,
        hit: false,
        error: "parse_failed",
      });
      return null;
    } finally {
      inflightLoads.delete(key);
    }
  })();

  inflightLoads.set(key, promise);
  return promise;
}

/** Debounce disk writes — memory stays hot immediately. */
const pendingSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleCachedEditionSave(
  bundle: CachedEditionBundle,
  delayMs = 400
): void {
  const normalized = {
    ...bundle,
    morningHeroArticleVersion: EDITION_CACHE_ARTICLE_VERSION,
    morningHero: bundle.morningHero
      ? parseMorningHeroExperience(bundle.morningHero) ?? bundle.morningHero
      : bundle.morningHero,
    intelligence: bundle.intelligence
      ? {
          ...bundle.intelligence,
          morningHero: bundle.intelligence.morningHero
            ? parseMorningHeroExperience(bundle.intelligence.morningHero) ??
              bundle.intelligence.morningHero
            : bundle.intelligence.morningHero,
        }
      : bundle.intelligence,
  };
  memoryBundles.set(
    memoryKey(normalized.userId, normalized.editionDate, normalized.metroKey),
    mergeMorningHeroIntoCachedBundle(normalized)
  );
  const key = cacheKey(normalized.userId, normalized.editionDate, normalized.metroKey);
  const existing = pendingSaveTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingSaveTimers.set(
    key,
    setTimeout(() => {
      pendingSaveTimers.delete(key);
      void saveCachedEdition(normalized);
    }, delayMs)
  );
}

export async function saveCachedEdition(bundle: CachedEditionBundle): Promise<void> {
  await masterpieceTraceAsync("article/cache-save", async () => {
    const normalized = {
      ...bundle,
      morningHeroArticleVersion: EDITION_CACHE_ARTICLE_VERSION,
      morningHero: bundle.morningHero
        ? parseMorningHeroExperience(bundle.morningHero) ?? bundle.morningHero
        : bundle.morningHero,
      intelligence: bundle.intelligence
        ? {
            ...bundle.intelligence,
            morningHero: bundle.intelligence.morningHero
              ? parseMorningHeroExperience(bundle.intelligence.morningHero) ??
                bundle.intelligence.morningHero
              : bundle.intelligence.morningHero,
          }
        : bundle.intelligence,
    };
    memoryBundles.set(
      memoryKey(normalized.userId, normalized.editionDate, normalized.metroKey),
      normalized
    );
    traceCachedTodayInHistory("async_storage", normalized);
    try {
      await AsyncStorage.setItem(
        cacheKey(normalized.userId, normalized.editionDate, normalized.metroKey),
        JSON.stringify(normalized)
      );
    } catch {
      // Cache write is best-effort — never block the reader.
    }
  }, { editionId: bundle.editionId, metroKey: bundle.metroKey });
}

export async function clearCachedEdition(
  userId: string,
  editionDate: string,
  metroKey?: string | null
): Promise<void> {
  if (metroKey) {
    memoryBundles.delete(memoryKey(userId, editionDate, metroKey));
    try {
      await AsyncStorage.removeItem(cacheKey(userId, editionDate, metroKey));
    } catch {
      // Best-effort.
    }
  }
  // Legacy unscoped keys — pre-market-isolation Gilbert bundles must not reuse.
  for (const [key] of memoryBundles) {
    if (key.startsWith(`${userId}:${editionDate}:`)) {
      memoryBundles.delete(key);
    }
  }
  try {
    await AsyncStorage.removeItem(legacyCacheKey(userId, editionDate));
  } catch {
    // Best-effort.
  }
}

/** Dev / tests — reset warm cache between runs. */
export function clearMemoryEditionCacheForTests(): void {
  memoryBundles.clear();
  inflightLoads.clear();
}
