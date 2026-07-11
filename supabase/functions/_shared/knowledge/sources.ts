/**
 * Trusted knowledge sources — encyclopedia / wire / magazine priors.
 * Modeled on how Nat Geo, Smithsonian, BBC, The Economist, and Reuters
 * ground stories in reference material rather than isolated headlines.
 */

export type TrustedKnowledgeSource = {
  name: string;
  tier:
    | "wire"
    | "encyclopedia"
    | "reference"
    | "magazine"
    | "guide"
    | "local"
    | "kindred";
  weight: number;
  facets: string[];
};

export const TRUSTED_KNOWLEDGE_SOURCES: TrustedKnowledgeSource[] = [
  {
    name: "Reuters",
    tier: "wire",
    weight: 1,
    facets: ["related_story", "previous_coverage", "why_this_matters"],
  },
  {
    name: "Associated Press",
    tier: "wire",
    weight: 1,
    facets: ["related_story", "previous_coverage"],
  },
  {
    name: "BBC",
    tier: "magazine",
    weight: 0.98,
    facets: ["trusted_explainer", "timeline", "definition"],
  },
  {
    name: "The Economist",
    tier: "magazine",
    weight: 0.98,
    facets: ["trusted_explainer", "why_this_matters", "definition"],
  },
  {
    name: "National Geographic",
    tier: "magazine",
    weight: 0.97,
    facets: ["map", "historical_background", "local_context"],
  },
  {
    name: "Smithsonian Magazine",
    tier: "magazine",
    weight: 0.97,
    facets: ["historical_background", "timeline", "definition"],
  },
  {
    name: "Wikipedia",
    tier: "encyclopedia",
    weight: 0.88,
    facets: ["definition", "historical_background", "timeline"],
  },
  {
    name: "Encyclopaedia Britannica",
    tier: "encyclopedia",
    weight: 0.95,
    facets: ["definition", "historical_background"],
  },
  {
    name: "Kindred Desk",
    tier: "kindred",
    weight: 0.85,
    facets: ["why_this_matters", "related_story", "previous_coverage"],
  },
  {
    name: "Local paper",
    tier: "local",
    weight: 0.8,
    facets: ["local_context", "map"],
  },
];

export function knowledgeSourcePrior(name: string): {
  score: number;
  tier: TrustedKnowledgeSource["tier"];
} {
  const key = name.toLowerCase();
  for (const s of TRUSTED_KNOWLEDGE_SOURCES) {
    if (key.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(key)) {
      return { score: s.weight, tier: s.tier };
    }
  }
  return { score: 0.55, tier: "reference" };
}
