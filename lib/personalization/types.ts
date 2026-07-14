/**
 * Client personalization contracts — shared with every future section.
 * Signals are quiet; ranking consumes aggregates at edition build time.
 */

export type ReadingSignalType =
  | "open"
  | "read_progress"
  | "read_complete"
  | "clip"
  | "unclip"
  | "like"
  | "unlike"
  | "skip"
  | "source_engage";

export type ReadingSignalInput = {
  signalType: ReadingSignalType;
  storyKey: string;
  sectionType?: string | null;
  editionId?: string | null;
  sectionId?: string | null;
  source?: string | null;
  topic?: string | null;
  payload?: Record<string, unknown>;
};

export type PersonalizationSnapshot = {
  followedTopics: string[];
  favoriteSources: string[];
  skippedTopics: string[];
};
