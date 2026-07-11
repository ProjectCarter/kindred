/**
 * Lightweight companion metadata stashed with an article for the reader.
 * Keeps Knowledge / personalization explanations available without
 * re-fetching the full edition on the article route.
 */

export type ArticleCompanion = {
  whyThisMatters?: {
    title: string;
    summary: string;
  } | null;
  whyChosen?: string | null;
};

const MAX_COMPANIONS = 16;
const companions = new Map<string, ArticleCompanion>();

function touch(articleId: string, companion: ArticleCompanion): void {
  companions.delete(articleId);
  companions.set(articleId, companion);
  while (companions.size > MAX_COMPANIONS) {
    const oldest = companions.keys().next().value;
    if (oldest === undefined) break;
    companions.delete(oldest);
  }
}

export function stashArticleCompanion(
  articleId: string,
  companion: ArticleCompanion
): void {
  touch(articleId, companion);
}

export function getArticleCompanion(
  articleId: string
): ArticleCompanion | null {
  return companions.get(articleId) ?? null;
}

export function clearArticleCompanion(articleId: string): void {
  companions.delete(articleId);
}
