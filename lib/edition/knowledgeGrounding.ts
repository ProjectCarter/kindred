/**
 * Client mirror — Knowledge Provider grounding contracts.
 * Server mirror: supabase/functions/_shared/knowledge/providers/types.ts
 */

export type KnowledgeProviderId = "wikipedia";

export type KnowledgeCoordinates = {
  lat: number;
  lon: number;
};

export type KnowledgeLookupResult = {
  provider: KnowledgeProviderId;
  pageTitle: string;
  canonicalUrl: string;
  editorialSummary: string;
  extract: string;
  pageId: number;
  language: string;
  coordinates?: KnowledgeCoordinates | null;
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  } | null;
  sourceAttribution: string;
  retrievedAt: string;
  confidence: number;
  conflictWithStructuredData?: string | null;
  matchedQuery?: string;
};

export type EditionKnowledgeGrounding = {
  onThisDay?: KnowledgeLookupResult | null;
  heroArtwork?: KnowledgeLookupResult | null;
  discoveryByItemId?: Record<string, KnowledgeLookupResult>;
  enrichedAt?: string;
  providersUsed?: KnowledgeProviderId[];
};

/** Build a museum/landmark background paragraph from stored grounding. */
export function discoveryBackgroundFromGrounding(
  grounding: KnowledgeLookupResult | null | undefined,
  venueTitle: string
): string | null {
  if (!grounding?.editorialSummary?.trim()) return null;
  return (
    `${venueTitle} has a longer story than a single afternoon visit: ${grounding.editorialSummary} ` +
    `(Background from Wikipedia — ${grounding.pageTitle}.)`
  );
}

export function formatKnowledgeAttribution(
  grounding: KnowledgeLookupResult | null | undefined
): string | null {
  if (!grounding?.sourceAttribution) return null;
  return grounding.sourceAttribution;
}
