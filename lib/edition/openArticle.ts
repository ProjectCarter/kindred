import type { Router } from "expo-router";
import type { KindredArticle } from "./article";
import { stashArticle } from "./articleStore";
import {
  stashArticleCompanion,
  type ArticleCompanion,
} from "./articleCompanion";
import { stashArticleSession } from "./articleSession";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../personalization";

export type OpenArticleOptions = {
  editionId?: string | null;
  companion?: ArticleCompanion | null;
  /** e.g. "← Today's paper" */
  backLabel?: string;
  /** edition_sections.id when Keep is available */
  clipSectionId?: string | null;
};

/**
 * Open the shared Kindred article reader.
 * Use from Lead, Top Stories, Sports, Science — any section.
 * Quietly records an open signal for personalization.
 * Persists session so external browser / backgrounding does not lose the story.
 */
export function openKindredArticle(
  router: Pick<Router, "push">,
  article: KindredArticle,
  options: OpenArticleOptions = {}
): void {
  const id = stashArticle(article);
  const companion = options.companion ?? null;
  if (companion) {
    stashArticleCompanion(id, companion);
  }

  const backLabel = options.backLabel?.trim() || "← Today’s paper";
  const clipSectionId = options.clipSectionId ?? null;

  stashArticleSession({
    article,
    companion,
    editionId: options.editionId ?? null,
    backLabel,
    clipSectionId,
    scrollY: 0,
    updatedAt: Date.now(),
  });

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
      params: {
        id,
        editionId: options.editionId,
        backLabel,
        clipSectionId: clipSectionId ?? "",
      },
    });
  } else {
    router.push({
      pathname: "/article/[id]",
      params: {
        id,
        backLabel,
        clipSectionId: clipSectionId ?? "",
      },
    });
  }
}
