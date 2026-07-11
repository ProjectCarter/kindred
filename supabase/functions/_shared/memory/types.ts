/**
 * Memory Engine — long-term reader relationship for Kindred.
 * Great newspapers remember; they do not restart from zero each morning.
 *
 * Supports: followed stories, continuing news, long-term interests,
 * previous reading, “since you last read…”, ongoing timelines,
 * saved discoveries, recurring events, reading continuity,
 * knowledge continuity, travel / favorite places, unfinished reading.
 *
 * Editorial integrity: memory informs continuity — it never overrides
 * the Newspaper Editor’s selection of today’s paper.
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
  /** ISO date when this memory last mattered. */
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
    /** Quiet morning continuity — not a gamification badge. */
    continuityDays: number;
    lastEditionDate: string | null;
    lastReadAt: string | null;
  };
  threads: MemoryThread[];
  /** Links today’s story ids to relevant memory threads. */
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
    /** Memory never overrides editorial selection. */
    editorialIntegrity: true;
    editorNotes: string[];
  };
};

export type MemoryStoryInput = {
  storyKey: string;
  section: string;
  headline: string;
  summary: string;
  role?: string;
  category?: string | null;
};

export type MemoryPriorEdition = {
  editionDate: string;
  lead?: { id?: string; headline?: string } | null;
  topStories?: Array<{ id?: string; title?: string }>;
  discoveryPicks?: Array<{
    id?: string;
    title: string;
    category?: string;
    why?: string;
  }>;
  knowledgeHighlights?: Array<{
    storyKey?: string;
    headline: string;
    facetType?: string;
    why?: string;
  }>;
};

export type MemoryUnfinishedRead = {
  storyKey: string;
  headline?: string | null;
  sectionType?: string | null;
  scrollPct: number;
  updatedAt: string;
};

export type MemoryClipping = {
  storyKey: string;
  headline?: string | null;
  source?: string | null;
  sectionType?: string | null;
  createdAt?: string | null;
};

export type MemoryCandidate = {
  thread: Omit<MemoryThread, "reasons"> & { reasons?: MemoryReason[] };
  linkedStoryKeys: string[];
  scoreHints: {
    continuity: number;
    relevance: number;
    integrity: number;
  };
};

export type MemoryRankingContext = {
  editionDate: string;
  now?: Date;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  homeLocation?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  travel?: {
    away?: boolean;
    city?: string | null;
    until?: string | null;
    note?: string | null;
  } | null;
  interests?: string[];
  followedTopics?: string[];
  favoriteSources?: string[];
  skippedTopics?: string[];
  confidence?: number;
  engagedStoryKeys?: string[];
  clippedStoryKeys?: string[];
  todayStories: MemoryStoryInput[];
  priorEditions?: MemoryPriorEdition[];
  unfinishedReads?: MemoryUnfinishedRead[];
  clippings?: MemoryClipping[];
  localEvents?: Array<{
    name: string;
    venue: string;
    city: string;
    startDateTime: string;
  }>;
  lastReadAt?: string | null;
  /** Calendar days with reading signals — used for quiet continuity. */
  openDays?: string[];
  maxThreads?: number;
};
