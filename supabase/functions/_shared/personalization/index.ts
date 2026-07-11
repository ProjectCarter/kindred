export type {
  AffinityWeight,
  PersonalizationAffinities,
  PersonalizationProfile,
  ReadingSignalRow,
} from "./types.ts";

export {
  aggregateReadingSignals,
  mergeSourceLists,
  mergeTopicLists,
} from "./aggregate.ts";

export { loadPersonalizationProfile } from "./loadPersonalizationProfile.ts";
