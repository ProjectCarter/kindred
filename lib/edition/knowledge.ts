/**
 * Client mirror — Knowledge Engine contracts.
 * Generation runs at edition build; the app reads stored payloads.
 * Every future article / section should request context through this layer.
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
  selectionMeta: {
    storyCount: number;
    facetCount: number;
    editorNotes: string[];
  };
};

/** Parse editions.knowledge jsonb. */
export function parseKnowledgePayload(value: unknown): KnowledgePayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<KnowledgePayload>;
  if (raw.version !== 1 || !raw.byStoryKey || typeof raw.byStoryKey !== "object") {
    return null;
  }
  return raw as KnowledgePayload;
}

/** Knowledge packet for one article (by KindredArticle.id / story id). */
export function knowledgeForStory(
  payload: KnowledgePayload | null | undefined,
  storyKey: string
): KnowledgePacket | null {
  if (!payload || !storyKey) return null;
  return payload.byStoryKey[storyKey] ?? null;
}

/**
 * Request knowledge for an article — primary API for future reader surfaces.
 * Pass the edition’s stored knowledge payload + article id.
 */
export function requestKnowledge(
  edition: { knowledge?: unknown } | null | undefined,
  article: { id: string } | string
): KnowledgePacket | null {
  const storyKey = typeof article === "string" ? article : article.id;
  return knowledgeForStory(parseKnowledgePayload(edition?.knowledge), storyKey);
}

export function facetsOfType(
  packet: KnowledgePacket | null | undefined,
  type: KnowledgeFacetType
): KnowledgeFacet[] {
  return packet?.facets.filter((f) => f.type === type) ?? [];
}

/** Calm prose — never mentions scores or algorithms. */
export function formatKnowledgeWhy(facet: KnowledgeFacet): string {
  const top = (facet.reasons ?? [])
    .filter((r) => r.weight > 0 && !r.code.startsWith("facet_"))
    .slice(0, 2)
    .map((r) => r.label);
  return top.join(" ") || facet.summary.slice(0, 140);
}

export function whyThisMatters(
  packet: KnowledgePacket | null | undefined
): KnowledgeFacet | null {
  return facetsOfType(packet, "why_this_matters")[0] ?? null;
}

export const KnowledgeService = {
  parseKnowledgePayload,
  knowledgeForStory,
  requestKnowledge,
  facetsOfType,
  formatKnowledgeWhy,
  whyThisMatters,
};

export default KnowledgeService;
