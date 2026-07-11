/**
 * Client mirror — Memory Engine contracts.
 * Generation runs at edition build; the app reads stored payloads.
 * Every future section should request continuity through this layer.
 */

export type MemoryThreadType =
  | "followed_story"
  | "continuing_news"
  | "long_term_interest"
  | "previous_reading"
  | "since_you_last_read"
  | "ongoing_timeline"
  | "saved_discovery"
  | "recurring_event"
  | "reading_streak"
  | "knowledge_continuity"
  | "favorite_location"
  | "travel_history"
  | "unfinished_reading";

export type MemoryReason = {
  code: string;
  label: string;
  weight: number;
};

export type MemoryThread = {
  id: string;
  type: MemoryThreadType;
  title: string;
  summary: string;
  since?: string | null;
  storyKeys?: string[];
  topic?: string | null;
  place?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  data?: {
    continuityDays?: number;
    daysAway?: number;
    scrollPct?: number;
    facetType?: string;
    category?: string;
    editionDates?: string[];
    headline?: string;
  };
  reasons: MemoryReason[];
};

export type MemoryStoryLink = {
  threadIds: string[];
  notes: string[];
};

export type MemoryPayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  reader: {
    confidence: number;
    continuityDays: number;
    lastEditionDate: string | null;
    lastReadAt: string | null;
  };
  threads: MemoryThread[];
  byStoryKey: Record<string, MemoryStoryLink>;
  sinceYouLastRead: {
    title: string;
    summary: string;
    daysAway: number | null;
    highlights: string[];
  } | null;
  highlights: Array<{
    threadId: string;
    type: MemoryThreadType;
    title: string;
    why: string;
  }>;
  editorBrief: string;
  selectionMeta: {
    threadCount: number;
    candidateCount: number;
    editorialIntegrity: true;
    editorNotes: string[];
  };
};

/** Parse editions.memory jsonb. */
export function parseMemoryPayload(value: unknown): MemoryPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MemoryPayload>;
  if (raw.version !== 1 || !Array.isArray(raw.threads)) return null;
  return raw as MemoryPayload;
}

/** Memory threads linked to one article (by KindredArticle.id). */
export function memoryForStory(
  payload: MemoryPayload | null | undefined,
  storyKey: string
): MemoryThread[] {
  if (!payload || !storyKey) return [];
  const link = payload.byStoryKey?.[storyKey];
  if (!link?.threadIds?.length) return [];
  const set = new Set(link.threadIds);
  return payload.threads.filter((t) => set.has(t.id));
}

/**
 * Request memory for an article / edition — primary API for future surfaces.
 */
export function requestMemory(
  edition: { memory?: unknown } | null | undefined,
  article?: { id: string } | string | null
): {
  payload: MemoryPayload | null;
  threads: MemoryThread[];
  sinceYouLastRead: MemoryPayload["sinceYouLastRead"];
} {
  const payload = parseMemoryPayload(edition?.memory);
  const storyKey =
    typeof article === "string"
      ? article
      : article?.id
      ? article.id
      : null;
  return {
    payload,
    threads: storyKey ? memoryForStory(payload, storyKey) : payload?.threads ?? [],
    sinceYouLastRead: payload?.sinceYouLastRead ?? null,
  };
}

export function threadsOfType(
  payload: MemoryPayload | null | undefined,
  type: MemoryThreadType
): MemoryThread[] {
  return payload?.threads.filter((t) => t.type === type) ?? [];
}

export function formatMemoryWhy(thread: MemoryThread): string {
  const top = (thread.reasons ?? [])
    .filter((r) => r.weight > 0 && !r.code.startsWith("memory_"))
    .slice(0, 2)
    .map((r) => r.label);
  return top.join(" ") || thread.summary.slice(0, 140);
}

export function sinceYouLastRead(
  payload: MemoryPayload | null | undefined
): MemoryPayload["sinceYouLastRead"] {
  return payload?.sinceYouLastRead ?? null;
}

export function unfinishedReads(
  payload: MemoryPayload | null | undefined
): MemoryThread[] {
  return threadsOfType(payload, "unfinished_reading");
}

export const MemoryService = {
  parseMemoryPayload,
  memoryForStory,
  requestMemory,
  threadsOfType,
  formatMemoryWhy,
  sinceYouLastRead,
  unfinishedReads,
};

export default MemoryService;
