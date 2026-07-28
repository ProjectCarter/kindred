import type { Router } from "expo-router";
import { withContentSystem, type KindredArticle } from "./article";
import { ensureArticleHero } from "./articleHero";
import {
  logArticleIntegrityFailure,
  validateArticleHandoff,
} from "./articleIntegrity";
import { stashArticle } from "./articleStore";
import {
  stashArticleCompanion,
  type ArticleCompanion,
} from "./articleCompanion";
import {
  getArticleSessionSync,
  stashArticleSession,
} from "./articleSession";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../personalization";
import { trackArticleOpenedOnce } from "../analytics";

export type OpenArticleOptions = {
  editionId?: string | null;
  companion?: ArticleCompanion | null;
  /** e.g. "← Back to Homepage" */
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
  const withHero = ensureArticleHero(withTemplate);

  const integrityFailure = validateArticleHandoff({
    expected: article,
    opened: withHero,
  });
  if (integrityFailure) {
    logArticleIntegrityFailure(integrityFailure, {
      section: article.section,
      source: article.source,
    });
    return;
  }

  const id = stashArticle(withHero);
  const companion = options.companion ?? null;
  if (companion) {
    stashArticleCompanion(id, companion);
  }

  const backLabel = options.backLabel?.trim() || "← Back to Homepage";
  const priorSession = getArticleSessionSync(withHero.id);

  stashArticleSession({
    article: withHero,
    companion,
    editionId: options.editionId ?? priorSession?.editionId ?? null,
    backLabel,
    scrollY: priorSession?.scrollY ?? 0,
    updatedAt: Date.now(),
  });

  const pushParams = options.editionId
    ? {
        pathname: "/article/[id]" as const,
        params: {
          id,
          editionId: options.editionId,
          backLabel,
        },
      }
    : {
        pathname: "/article/[id]" as const,
        params: {
          id,
          backLabel,
        },
      };

  router.push(pushParams);

  trackArticleOpenedOnce({
    contentId: withHero.id,
    contentTitle: withHero.headline,
    sectionType: withHero.section,
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
}
