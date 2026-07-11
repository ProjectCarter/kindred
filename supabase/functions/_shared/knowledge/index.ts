export type {
  KnowledgeCandidate,
  KnowledgeFacet,
  KnowledgeFacetType,
  KnowledgePacket,
  KnowledgePayload,
  KnowledgeRankingContext,
  KnowledgeReason,
  KnowledgeSource,
  KnowledgeStoryInput,
} from "./types.ts";

export {
  TRUSTED_KNOWLEDGE_SOURCES,
  knowledgeSourcePrior,
} from "./sources.ts";

export {
  extractKeyTerms,
  inferTopicLabel,
  tokenOverlap,
} from "./extract.ts";

export { buildKnowledgeCandidates } from "./catalog.ts";
export { scoreKnowledgeCandidate } from "./score.ts";
export { selectKnowledgePacket, whyFacet } from "./select.ts";
export { runKnowledgeDecisions } from "./decide.ts";
