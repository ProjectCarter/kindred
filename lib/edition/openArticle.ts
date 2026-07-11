import type { Router } from "expo-router";
import type { KindredArticle } from "./article";
import { stashArticle } from "./articleStore";
import {
  stashArticleCompanion,
  type ArticleCompanion,
} from "./articleCompanion";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../personalization";

export type OpenArticleOptions = {
  editionId?: string | null;
  companion?: ArticleCompanion | null;
};

/**
 * Open the shared Kindred article reader.
 * Use from Lead, Top Stories, Sports, Science — any section.
 * Quietly records an open signal for personalization.
 */
export function openKindredArticle(
  router: Pick<Router, "push">,
  article: KindredArticle,
  options: OpenArticleOptions = {}
): void {
  const id = stashArticle(article);
  if (options.companion) {
    stashArticleCompanion(id, options.companion);
  }
  void trackReadingSignal({
    signalType: "open",
    storyKey: article.id,
    sectionType: article.section,
    editionId: options.editionId,
    source: article.source,
    topic: inferTopicFromSection(article.section, article.headline),
    payload: {
      headline: article.headline.slice(0, 160),
      url: article.sourceUrl ?? null,
    },
  });

  if (options.editionId) {
    router.push({
      pathname: "/article/[id]",
      params: { id, editionId: options.editionId },
    });
  } else {
    router.push(`/article/${id}`);
  }
}
