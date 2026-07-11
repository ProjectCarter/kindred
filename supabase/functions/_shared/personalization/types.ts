/**
 * Personalization engine — Edge Function side.
 * Aggregates quiet reading signals into ranking affinities
 * reusable by every future Kindred section.
 */

export type AffinityWeight = {
  key: string;
  weight: number;
};

export type PersonalizationAffinities = {
  /** Publishers the reader engages with (normalized keys + display). */
  favoriteSources: AffinityWeight[];
  /** Topics learned from opens, deep reads, and clips. */
  followedTopics: AffinityWeight[];
  /** Topics repeatedly skipped or abandoned. */
  skippedTopics: AffinityWeight[];
  /** Story keys / headlines recently engaged. */
  engagedStoryKeys: string[];
  /** Story keys clipped. */
  clippedStoryKeys: string[];
  /** Soft signal: how strong personalization is (0–1). */
  confidence: number;
};

export type PersonalizationProfile = {
  interests: string[];
  followedTopics: string[];
  favoriteSources: string[];
  skippedTopics: string[];
  city: string | null;
  region: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  affinities: PersonalizationAffinities;
};

export type ReadingSignalRow = {
  signal_type: string;
  story_key: string;
  section_type: string | null;
  source: string | null;
  topic: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};
