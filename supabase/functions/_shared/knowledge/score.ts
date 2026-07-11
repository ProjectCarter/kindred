import { knowledgeSourcePrior } from "./sources.ts";
import type {
  KnowledgeCandidate,
  KnowledgeFacet,
  KnowledgeRankingContext,
  KnowledgeReason,
} from "./types.ts";

export type ScoredKnowledgeCandidate = {
  candidate: KnowledgeCandidate;
  storyKey: string;
  score: number;
  reasons: KnowledgeReason[];
  facet: KnowledgeFacet;
};

/**
 * Score a knowledge candidate for a specific story —
 * trust and relevance first, the way a reference desk would.
 */
export function scoreKnowledgeCandidate(
  candidate: KnowledgeCandidate,
  storyKey: string,
  _ctx: KnowledgeRankingContext
): ScoredKnowledgeCandidate | null {
  if (!candidate.targetStoryKeys.includes(storyKey)) return null;

  const reasons: KnowledgeReason[] = [];
  let score = 0;

  const rel = candidate.scoreHints.relevance * 24;
  score += rel;
  reasons.push({
    code: "relevance",
    label: "Relevant to this article’s subject",
    weight: rel,
  });

  const prior = knowledgeSourcePrior(candidate.facet.source.name);
  const trust =
    Math.max(candidate.scoreHints.trust, prior.score) * 18;
  score += trust;
  reasons.push({
    code: "trusted_source",
    label: `Trusted reference (${candidate.facet.source.name})`,
    weight: trust,
  });

  const fresh = candidate.scoreHints.freshness * 8;
  score += fresh;
  if (fresh >= 6) {
    reasons.push({
      code: "freshness",
      label: "Timely for this morning’s edition",
      weight: fresh,
    });
  }

  // Soft preference by facet type for teaching value
  const typeBoost: Record<string, number> = {
    why_this_matters: 10,
    trusted_explainer: 8,
    historical_background: 7,
    previous_coverage: 6,
    related_story: 6,
    local_context: 5,
    definition: 4,
    timeline: 5,
    map: 4,
  };
  const boost = typeBoost[candidate.facet.type] ?? 2;
  score += boost;
  reasons.push({
    code: `facet_${candidate.facet.type}`,
    label: facetLabel(candidate.facet.type),
    weight: boost,
  });

  const facet: KnowledgeFacet = {
    ...candidate.facet,
    source: {
      ...candidate.facet.source,
      tier: prior.tier,
    },
    reasons: reasons.sort((a, b) => b.weight - a.weight),
  };

  return {
    candidate,
    storyKey,
    score,
    reasons: facet.reasons,
    facet,
  };
}

function facetLabel(type: string): string {
  switch (type) {
    case "why_this_matters":
      return "Helps the reader understand stakes";
    case "trusted_explainer":
      return "Trusted explainer background";
    case "historical_background":
      return "Historical background";
    case "previous_coverage":
      return "Connects to previous coverage";
    case "related_story":
      return "Related story in today’s paper";
    case "local_context":
      return "Local context";
    case "definition":
      return "Definition / glossary";
    case "timeline":
      return "Timeline context";
    case "map":
      return "Geographic context";
    default:
      return "Editorial knowledge";
  }
}
