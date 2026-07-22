import { isClippableSectionId, type KindredArticle } from "./article";
import type { ClippingContentType } from "./clippingTypes";

export type SaveTarget = {
  contentType: ClippingContentType;
  clipKey: string;
  sectionId: string | null;
};

/** @deprecated Use SaveTarget — kept for likes table compatibility. */
export type ClipTarget = SaveTarget;

/** Best-effort bucket when an adapter didn't explicitly tag `savedContentType`. */
export function inferClipContentType(
  article: KindredArticle
): ClippingContentType {
  if (article.savedContentType) return article.savedContentType;
  if (article.section === "local_events") return "event";
  if (article.section === "discovery" || article.section === "bandits_pick") {
    return "recommendation";
  }
  return "article";
}

/**
 * Resolves whether — and how — an article can be saved (liked).
 * Lead and Kindred-authored discovery/knowledge briefs are not saveable.
 */
export function resolveSaveTarget(article: KindredArticle): SaveTarget | null {
  const contentType = inferClipContentType(article);

  if (contentType === "article") {
    if (
      article.section === "lead" ||
      article.section === "discovery" ||
      article.section === "knowledge"
    ) {
      return null;
    }
    if (!isClippableSectionId(article.id)) return null;
    return {
      contentType,
      clipKey: `article:${article.id}`,
      sectionId: article.id,
    };
  }

  if (!article.id) return null;
  return {
    contentType,
    clipKey: `${contentType}:${article.id}`,
    sectionId: null,
  };
}

/** @deprecated Use resolveSaveTarget */
export const resolveClipTarget = resolveSaveTarget;
