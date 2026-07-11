import type { KindredArticle } from "./article";

/**
 * In-memory handoff for opening the shared article reader.
 * Expo Router params are too small for full article bodies;
 * stash before navigate, read on the article screen.
 *
 * Bounded LRU so long sessions cannot grow without limit.
 */
const MAX_STASHED = 16;
const store = new Map<string, KindredArticle>();

function touch(id: string, article: KindredArticle): void {
  // Re-insert to mark as most-recently used (Map preserves insertion order).
  store.delete(id);
  store.set(id, article);
  while (store.size > MAX_STASHED) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function stashArticle(article: KindredArticle): string {
  touch(article.id, article);
  return article.id;
}

export function getStashedArticle(id: string): KindredArticle | null {
  const article = store.get(id);
  if (!article) return null;
  // Refresh recency on read so open articles aren't evicted first.
  touch(id, article);
  return article;
}

export function clearStashedArticle(id: string): void {
  store.delete(id);
}
