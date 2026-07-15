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

const CACHE_KEY_PREFIX = "@kindred/edition-cache:";

export type CachedEditionBundle = {
  userId: string;
  editionId: string;
  editionDate: string;
  cachedAt: number;
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

export async function loadCachedEdition(
  userId: string,
  editionDate: string
): Promise<CachedEditionBundle | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId, editionDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEditionBundle;
    if (
      !parsed ||
      parsed.userId !== userId ||
      parsed.editionDate !== editionDate ||
      !Array.isArray(parsed.sections)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedEdition(bundle: CachedEditionBundle): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(bundle.userId, bundle.editionDate),
      JSON.stringify(bundle)
    );
  } catch {
    // Cache write is best-effort — never block the reader.
  }
}

export async function clearCachedEdition(
  userId: string,
  editionDate: string
): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(userId, editionDate));
  } catch {
    // Best-effort.
  }
}
