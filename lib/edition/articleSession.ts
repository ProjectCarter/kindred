import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KindredArticle } from "./article";
import type { ArticleCompanion } from "./articleCompanion";

const PREFIX = "@kindred/article-session/";
const INDEX_KEY = "@kindred/article-session-index";
const MAX_PERSISTED = 12;

/**
 * Durable handoff for the native article reader.
 * Survives backgrounding, external browser, and soft process death
 * so Kindred remains the primary reading destination.
 */
export type ArticleSession = {
  article: KindredArticle;
  companion: ArticleCompanion | null;
  editionId: string | null;
  /** Native back label — e.g. "← Today's paper" */
  backLabel: string;
  scrollY: number;
  updatedAt: number;
};

const memory = new Map<string, ArticleSession>();

function storageKey(id: string): string {
  return `${PREFIX}${id}`;
}

async function touchIndex(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX_PERSISTED);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));

    const dropped = list.filter((x) => !next.includes(x));
    if (dropped.length) {
      await AsyncStorage.multiRemove(dropped.map(storageKey));
      for (const d of dropped) memory.delete(d);
    }
  } catch {
    /* Persistence best-effort — memory still works. */
  }
}

export function stashArticleSession(session: ArticleSession): string {
  const id = session.article.id;
  const next: ArticleSession = {
    ...session,
    updatedAt: Date.now(),
  };
  memory.set(id, next);
  void AsyncStorage.setItem(storageKey(id), JSON.stringify(next))
    .then(() => touchIndex(id))
    .catch(() => {});
  return id;
}

export function updateArticleSessionScroll(
  id: string,
  scrollY: number
): void {
  const current = memory.get(id);
  if (!current) return;
  const next = { ...current, scrollY, updatedAt: Date.now() };
  memory.set(id, next);
  void AsyncStorage.setItem(storageKey(id), JSON.stringify(next)).catch(() => {});
}

export function getArticleSessionSync(id: string): ArticleSession | null {
  return memory.get(id) ?? null;
}

export async function loadArticleSession(
  id: string
): Promise<ArticleSession | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArticleSession;
    if (!parsed?.article?.id || !parsed.article.headline) return null;
    memory.set(id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearArticleSession(id: string): void {
  memory.delete(id);
  void AsyncStorage.removeItem(storageKey(id)).catch(() => {});
}

/** TEMP(Phase One perf): wipe reader handoff memory for cold-launch simulation. */
export function clearAllArticleSessions(): void {
  memory.clear();
}
