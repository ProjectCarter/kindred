/**
 * Local edition cache — show today's paper immediately on cold start while
 * the network catches up. A printed newspaper should never leave the reader
 * staring at a loading screen for minutes when yesterday's bundle is still
 * on the shelf.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EditionSection } from "./types";
import type { LeadStory } from "./LeadStory";
import type { TopStoryItem } from "./topStories";
import type { BanditPayload } from "./bandit";
import type { EditionIntelligence } from "./surfaceIntelligence";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { parseMorningHeroExperience } from "./morningEdition";
import { mergeMorningHeroIntoCachedBundle } from "./resolveMorningHero";
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

const CACHE_KEY_PREFIX = "@kindred/edition-cache:";
/** Bump when morning hero article sanitization changes — invalidates stale detail on disk. */
export const EDITION_CACHE_ARTICLE_VERSION = 2;

export type CachedEditionBundle = {
  userId: string;
  editionId: string;
  editionDate: string;
  cachedAt: number;
  /** Bumped when masterpiece article payload normalization changes. */
  morningHeroArticleVersion?: number;
  sections: EditionSection[];
  leadStory: LeadStory | null;
  topStories: TopStoryItem[];
  bandit: BanditPayload | null;
  intelligence: EditionIntelligence | null;
  /** Frozen hero selection — stable for the life of this edition. */
  heroImageId?: string | null;
  /** Frozen daily artwork hero from morning_edition.morningHero. */
  morningHero?: MorningHeroExperience | null;
};

function cacheKey(userId: string, editionDate: string): string {
  return `${CACHE_KEY_PREFIX}${userId}:${editionDate}`;
}

function memoryKey(userId: string, editionDate: string): string {
  return `${userId}:${editionDate}`;
}

/** In-process warm cache — instant on warm relaunch within the same JS session. */
const memoryBundles = new Map<string, CachedEditionBundle>();

/** Coalesce concurrent disk reads for the same edition key. */
const inflightLoads = new Map<string, Promise<CachedEditionBundle | null>>();

function normalizeCachedBundle(
  parsed: CachedEditionBundle,
  userId: string,
  editionDate: string
): CachedEditionBundle | null {
  if (
    !parsed ||
    parsed.userId !== userId ||
    parsed.editionDate !== editionDate ||
    !Array.isArray(parsed.sections)
  ) {
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
  parsed.morningHeroArticleVersion = EDITION_CACHE_ARTICLE_VERSION;
  return mergeMorningHeroIntoCachedBundle(parsed);
}

/** Synchronous warm-cache read — no AsyncStorage, no JSON parse. */
export function peekMemoryCachedEdition(
  userId: string,
  editionDate: string
): CachedEditionBundle | null {
  return memoryBundles.get(memoryKey(userId, editionDate)) ?? null;
}

export async function loadCachedEdition(
  userId: string,
  editionDate: string
): Promise<CachedEditionBundle | null> {
  const warm = peekMemoryCachedEdition(userId, editionDate);
  if (warm) {
    recordEditionCacheMemoryHit();
    return warm;
  }

  const key = cacheKey(userId, editionDate);
  const inflight = inflightLoads.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    masterpieceTraceBegin("article/cache-load", { userId, editionDate });
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
        editionDate
      );
      if (parsed) {
        memoryBundles.set(memoryKey(userId, editionDate), parsed);
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
    memoryKey(normalized.userId, normalized.editionDate),
    mergeMorningHeroIntoCachedBundle(normalized)
  );
  const key = cacheKey(normalized.userId, normalized.editionDate);
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
    memoryBundles.set(memoryKey(normalized.userId, normalized.editionDate), normalized);
    try {
      await AsyncStorage.setItem(
        cacheKey(normalized.userId, normalized.editionDate),
        JSON.stringify(normalized)
      );
    } catch {
      // Cache write is best-effort — never block the reader.
    }
  }, { editionId: bundle.editionId });
}

export async function clearCachedEdition(
  userId: string,
  editionDate: string
): Promise<void> {
  memoryBundles.delete(memoryKey(userId, editionDate));
  try {
    await AsyncStorage.removeItem(cacheKey(userId, editionDate));
  } catch {
    // Best-effort.
  }
}

/** Dev / tests — reset warm cache between runs. */
export function clearMemoryEditionCacheForTests(): void {
  memoryBundles.clear();
  inflightLoads.clear();
}
