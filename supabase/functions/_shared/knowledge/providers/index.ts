import type { KnowledgeProvider } from "./types.ts";
import { isWikipediaKnowledgeEnabled, wikipediaKnowledgeProvider } from "./wikipedia.ts";

export type { KnowledgeProviderId, KnowledgeLookupResult, KnowledgeSearchInput, KnowledgeProvider, EditionKnowledgeGrounding } from "./types.ts";
export { KNOWLEDGE_CACHE_TTL_HOURS } from "./types.ts";
export { MIN_KNOWLEDGE_CONFIDENCE } from "./confidence.ts";
export { isWikipediaEligible } from "./eligibility.ts";
export {
  synthesizeEditorialSummary,
  buildOnThisDaySearchQuery,
  buildTodayInHistoryGrounding,
} from "./synthesize.ts";
export {
  lookupWikipedia,
  lookupOnThisDaySubject,
  lookupHeroArtworkSubject,
  isWikipediaKnowledgeEnabled,
  wikipediaKnowledgeProvider,
} from "./wikipedia.ts";
export {
  enrichEditionKnowledge,
  enrichDiscoveryKnowledge,
} from "./enrich.ts";

/** Active knowledge providers — Wikipedia first; future sources register here. */
export function getKnowledgeProviders(): KnowledgeProvider[] {
  const providers: KnowledgeProvider[] = [];
  if (isWikipediaKnowledgeEnabled()) {
    providers.push(wikipediaKnowledgeProvider);
  }
  return providers;
}
