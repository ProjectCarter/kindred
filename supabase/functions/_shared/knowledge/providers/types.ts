/**
 * Knowledge Provider contracts — grounded background for Kindred editorial.
 * Wikipedia is the first provider; future sources plug into the same shape.
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
  /** Short Kindred-synthesized summary — not raw Wikipedia copy. */
  editorialSummary: string;
  /** Raw extract from provider (for audit / conflict checks — not for UI display). */
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
  /** 0–1 match confidence; lookups below threshold are discarded. */
  confidence: number;
  /** When structured place data disagrees with the matched page title. */
  conflictWithStructuredData?: string | null;
  /** Which search query produced this match. */
  matchedQuery?: string;
};

export type KnowledgeSearchInput = {
  entityName: string;
  context?: string | null;
  hints?: string[];
};

export type KnowledgeProvider = {
  id: KnowledgeProviderId;
  label: string;
  lookup(
    admin: import("https://esm.sh/@supabase/supabase-js@2.45.4").SupabaseClient,
    input: KnowledgeSearchInput
  ): Promise<KnowledgeLookupResult | null>;
};

export type EditionKnowledgeGrounding = {
  onThisDay?: KnowledgeLookupResult | null;
  heroArtwork?: KnowledgeLookupResult | null;
  discoveryByItemId?: Record<string, KnowledgeLookupResult>;
  enrichedAt?: string;
  providersUsed?: KnowledgeProviderId[];
};

/** Cache TTL — background facts change slowly. */
export const KNOWLEDGE_CACHE_TTL_HOURS = 24 * 7;
