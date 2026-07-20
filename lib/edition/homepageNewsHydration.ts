import type { CachedEditionBundle } from "./editionCache.ts";
import {
  resolveNationalNewsForRender,
  type NationalNewsPackage,
} from "./nationalNewsTypes.ts";
import {
  topStoriesFromEditorialContext,
  type TopStoryItem,
} from "./topStoriesFromContext.ts";

export type EditionNewsRow = {
  national_news?: unknown;
  editorial_context?: unknown;
};

/** Resolve Local + National news desks from a network edition row. */
export function resolveEditionNewsDesks(
  edition: EditionNewsRow,
  editionDate: string
): { topStories: TopStoryItem[]; nationalNews: NationalNewsPackage | null } {
  const topStories = topStoriesFromEditorialContext(edition.editorial_context);
  const nationalNews = resolveNationalNewsForRender({
    edition,
    topStories,
    editionDate,
  });
  return { topStories, nationalNews };
}

/**
 * Warm-cache hydration — prefer persisted nationalNews; fall back to legacy
 * top_stories adapter when older bundles omit the dedicated column.
 */
export function resolveNationalNewsForCachedBundle(
  bundle: Pick<
    CachedEditionBundle,
    "nationalNews" | "topStories" | "editionDate"
  >
): NationalNewsPackage | null {
  if (bundle.nationalNews) {
    return bundle.nationalNews;
  }
  return resolveNationalNewsForRender({
    edition: null,
    topStories: bundle.topStories ?? [],
    editionDate: bundle.editionDate,
  });
}

/** Persist national news into a cached bundle after network desk sync. */
export function withSyncedNewsDesksInCache(
  bundle: CachedEditionBundle,
  desks: { topStories: TopStoryItem[]; nationalNews: NationalNewsPackage | null }
): CachedEditionBundle {
  return {
    ...bundle,
    topStories: desks.topStories,
    nationalNews: desks.nationalNews,
  };
}
