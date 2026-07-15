import type { KindredArticle } from "./article";
import { getStashedArticle } from "./articleStore";
import {
  getGoldRelatedArticle,
  getGoldStandardArticle,
  getGoldStandardCompanion,
  GOLD_STANDARD_ARTICLE_ID,
  isGoldStandardArticleId,
} from "./goldStandard/algalBloomArticle";
import { getArticleCompanion } from "./articleCompanion";
import { terminalEditorialContinuation } from "./editorialContinuation";
import {
  getArticleSessionSync,
  loadArticleSession,
  type ArticleSession,
} from "./articleSession";

export type ResolveArticleSessionResult = {
  session: ArticleSession | null;
  /** True when only AsyncStorage can supply the handoff. */
  needsAsync: boolean;
};

function decodeRouteId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function buildSession(
  article: KindredArticle,
  articleId: string,
  editionId?: string | null,
  backLabel?: string | null,
  scrollY = 0
): ArticleSession {
  return {
    article,
    companion:
      getArticleCompanion(articleId) ??
      (isGoldStandardArticleId(articleId) ? getGoldStandardCompanion() : null),
    editionId: editionId?.trim() ? editionId : null,
    backLabel:
      backLabel?.trim() ||
      (articleId === GOLD_STANDARD_ARTICLE_ID
        ? "← Today’s paper"
        : "← Today’s paper"),
    scrollY,
    updatedAt: Date.now(),
  };
}

/**
 * Resolve an article reader session synchronously when memory already holds
 * the handoff from openKindredArticle — the common card-tap path.
 */
export function resolveArticleSessionSync(
  rawId: string | null | undefined,
  options?: {
    editionId?: string | null;
    backLabel?: string | null;
  }
): ResolveArticleSessionResult {
  if (!rawId?.trim()) {
    return { session: null, needsAsync: false };
  }

  const articleId = decodeRouteId(rawId.trim());
  const editionId = options?.editionId ?? null;
  const backLabel = options?.backLabel ?? null;

  const sync = getArticleSessionSync(articleId);
  if (sync) {
    return { session: sync, needsAsync: false };
  }

  const memoryArticle = getStashedArticle(articleId);
  if (memoryArticle) {
    return {
      session: buildSession(memoryArticle, articleId, editionId, backLabel),
      needsAsync: false,
    };
  }

  if (articleId === GOLD_STANDARD_ARTICLE_ID) {
    return {
      session: buildSession(
        getGoldStandardArticle(),
        articleId,
        editionId,
        backLabel
      ),
      needsAsync: false,
    };
  }

  const goldRelated = getGoldRelatedArticle(articleId);
  if (goldRelated) {
    return {
      session: {
        article: goldRelated,
        companion: {
          whyThisMatters: null,
          whyChosen: null,
          banditNote: goldRelated.banditNote ?? null,
          knowledgeNotes: [],
          knowledgeCards: [],
          continueReading: terminalEditorialContinuation(),
        },
        editionId: editionId?.trim() ? editionId : null,
        backLabel: backLabel?.trim() || "← Previous story",
        scrollY: 0,
        updatedAt: Date.now(),
      },
      needsAsync: false,
    };
  }

  return { session: null, needsAsync: true };
}

export async function loadArticleSessionFromPersistence(
  rawId: string,
  options?: {
    editionId?: string | null;
    backLabel?: string | null;
  }
): Promise<ArticleSession | null> {
  const articleId = decodeRouteId(rawId.trim());
  return loadArticleSession(articleId);
}
