import type { CachedEditionBundle } from "./editionCache.ts";
import {
  nationalNewsFromEdition,
  nationalNewsFromLegacyTopStories,
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

/** Never replace hydrated National News with null from a stale cache field. */
export function mergeNationalNewsState(
  existing: NationalNewsPackage | null | undefined,
  incoming: NationalNewsPackage | null | undefined
): NationalNewsPackage | null {
  if (incoming) return incoming;
  return existing ?? null;
}

/** Resolve Local + National news desks from a network edition row. */
export function resolveEditionNewsDesks(
  edition: EditionNewsRow,
  editionDate: string
): { topStories: TopStoryItem[]; nationalNews: NationalNewsPackage | null } {
  const topStories = topStoriesFromEditorialContext(edition.editorial_context);
  let nationalNews = resolveNationalNewsForRender({
    edition,
    topStories,
    editionDate,
    columnOnly: true,
  });
  if (!nationalNews && topStories.length > 0) {
    nationalNews = nationalNewsFromLegacyTopStories(topStories, editionDate);
    if (nationalNews && typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[home:nationalNews:hydration] legacy_top_stories_fallback", {
        editionDate,
        storyCount: nationalNews.stories.length,
        packageId: nationalNews.packageId,
      });
    }
  }
  return { topStories, nationalNews };
}

/**
 * Warm-cache hydration — prefer persisted nationalNews. When absent, callers
 * must hydrate from the network edition row; legacy top_stories are not a
 * reliable National News source once Local News owns the slate.
 */
export function resolveNationalNewsForCachedBundle(
  bundle: Pick<
    CachedEditionBundle,
    "nationalNews" | "topStories" | "editionDate"
  >,
  options?: { editionNationalNews?: unknown }
): NationalNewsPackage | null {
  if (bundle.nationalNews) {
    return bundle.nationalNews;
  }
  const fromEdition = nationalNewsFromEdition(
    options?.editionNationalNews != null
      ? { national_news: options.editionNationalNews }
      : null
  );
  if (fromEdition) return fromEdition;
  return null;
}

/** Persist national news into a cached bundle after network desk sync. */
export function withSyncedNewsDesksInCache(
  bundle: CachedEditionBundle,
  desks: { topStories: TopStoryItem[]; nationalNews: NationalNewsPackage | null }
): CachedEditionBundle {
  return {
    ...bundle,
    topStories: desks.topStories,
    nationalNews: mergeNationalNewsState(bundle.nationalNews, desks.nationalNews),
  };
}
