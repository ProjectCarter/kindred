/**
 * Knowledge Engine — trustworthy context for Kindred articles.
 * Magazines teach; they do not leave headlines stranded.
 *
 * Every future article can request: related stories, historical background,
 * timelines, maps, definitions, trusted explainers, previous coverage,
 * local context, and why this matters.
 */

export type KnowledgeFacetType =
  | "related_story"
  | "historical_background"
  | "timeline"
  | "map"
  | "definition"
  | "trusted_explainer"
  | "previous_coverage"
  | "local_context"
  | "why_this_matters";

export type KnowledgeSource = {
  name: string;
  tier:
    | "wire"
    | "encyclopedia"
    | "reference"
    | "magazine"
    | "guide"
    | "local"
    | "kindred";
  url?: string | null;
};

export type KnowledgeReason = {
  code: string;
  label: string;
  weight: number;
};

export type KnowledgeFacet = {
  type: KnowledgeFacetType;
  title: string;
  summary: string;
  source: KnowledgeSource;
  reasons: KnowledgeReason[];
  data?: {
    storyKey?: string;
    headline?: string;
    editionDate?: string;
    section?: string;
    term?: string;
    wikipediaTitle?: string;
    wikipediaUrl?: string;
    wikipediaPageId?: number;
    extract?: string;
    groundingSource?: "wikipedia";
    groundingConfidence?: number;
    /** Knowledge Card entity role when type is definition. */
    entityKind?:
      | "person"
      | "company"
      | "place"
      | "law"
      | "event"
      | "organization"
      | "term";
    events?: Array<{ date: string; label: string }>;
    lat?: number;
    lon?: number;
    placeLabel?: string;
    radiusKm?: number;
  };
};

export type KnowledgePacket = {
  storyKey: string;
  section: string;
  headline: string;
  facets: KnowledgeFacet[];
  editorBrief: string;
  selectionMeta: {
    candidateCount: number;
    selectedCount: number;
    editorNotes: string[];
  };
};

export type EditionKnowledgeGrounding = {
  onThisDay?: import("./providers/types.ts").KnowledgeLookupResult | null;
  heroArtwork?: import("./providers/types.ts").KnowledgeLookupResult | null;
  discoveryByItemId?: Record<
    string,
    import("./providers/types.ts").KnowledgeLookupResult
  >;
  enrichedAt?: string;
  providersUsed?: Array<"wikipedia">;
};

export type KnowledgePayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  byStoryKey: Record<string, KnowledgePacket>;
  highlights: Array<{
    storyKey: string;
    headline: string;
    facetType: KnowledgeFacetType;
    why: string;
  }>;
  editorBrief: string;
  /** Wikipedia and future provider grounding metadata for this edition. */
  providerGrounding?: EditionKnowledgeGrounding;
  selectionMeta: {
    storyCount: number;
    facetCount: number;
    editorNotes: string[];
  };
};

export type KnowledgeStoryInput = {
  storyKey: string;
  section: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  role?: string;
  category?: string | null;
  publishedAt?: string | null;
  reasons?: Array<{ code: string; label: string; weight: number }>;
};

export type KnowledgeCandidate = {
  facet: Omit<KnowledgeFacet, "reasons"> & { reasons?: KnowledgeReason[] };
  targetStoryKeys: string[];
  scoreHints: {
    relevance: number;
    trust: number;
    freshness: number;
  };
};

export type KnowledgeRankingContext = {
  editionDate: string;
  now?: Date;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
    lat?: number | null;
    lon?: number | null;
  };
  stories: KnowledgeStoryInput[];
  onThisDay?: { year: number; text: string } | null;
  localEvents?: Array<{
    name: string;
    venue: string;
    city: string;
    startDateTime: string;
  }>;
  recentStoryKeys?: string[];
  interests?: string[];
  followedTopics?: string[];
  discoveryPicks?: Array<{
    id: string;
    title: string;
    category: string;
    why: string;
  }>;
  maxFacetsPerStory?: number;
};
