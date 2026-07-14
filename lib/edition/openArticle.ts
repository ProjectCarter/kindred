import type { Router } from "expo-router";
import { withContentSystem, type KindredArticle } from "./article";
import { ensureArticleHero } from "./articleHero";
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
  // Every piece of content resolves a desk template before opening.
  const withTemplate = withContentSystem(article);
  // Visual identity is required — wire photo or curated editorial fallback.
  const withHero = ensureArticleHero(withTemplate);
  const id = stashArticle(withHero);
  const companion = options.companion ?? null;
  if (companion) {
    stashArticleCompanion(id, companion);
  }

  const backLabel = options.backLabel?.trim() || "← Today’s paper";

  stashArticleSession({
    article: withHero,
    companion,
    editionId: options.editionId ?? null,
    backLabel,
    scrollY: 0,
    updatedAt: Date.now(),
  });

  void trackReadingSignal({
    signalType: "open",
    storyKey: withHero.id,
    sectionType: withHero.section,
    editionId: options.editionId,
    source: withHero.source,
    topic: inferTopicFromSection(withHero.section, withHero.headline),
    payload: {
      headline: withHero.headline.slice(0, 160),
      url: withHero.sourceUrl ?? null,
      heroKind: withHero.heroImage?.kind ?? null,
    },
  });

  if (options.editionId) {
    router.push({
      pathname: "/article/[id]",
      params: {
        id,
        editionId: options.editionId,
        backLabel,
      },
    });
  } else {
    router.push({
      pathname: "/article/[id]",
      params: {
        id,
        backLabel,
      },
    });
  }
}
