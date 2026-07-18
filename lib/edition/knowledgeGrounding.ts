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

export type TodayInHistoryDeskSync = {
  year: number;
  eventText: string;
  articleFingerprint: string;
  imageFingerprint: string;
  nationalDailyId: string | null;
  syncedAt: string;
  source: "national_daily" | "client_recovery" | "server_recovery";
};

export type EditionKnowledgeGrounding = {
  onThisDay?: KnowledgeLookupResult | null;
  /** Authentic historical media for Today in History — never AI or stock. */
  onThisDayImage?: HistoricalImageAsset | null;
  /** Binds article + image to one Today in History record on device. */
  onThisDaySync?: TodayInHistoryDeskSync | null;
  onThisDaySelection?: TodayInHistorySelectionMeta | null;
  heroArtwork?: KnowledgeLookupResult | null;
  discoveryByItemId?: Record<string, KnowledgeLookupResult>;
  enrichedAt?: string;
  providersUsed?: KnowledgeProviderId[];
};

export type HistoricalImageSource = "wikimedia_commons" | "wikipedia";

export type HistoricalAssetKind =
  | "photograph"
  | "painting"
  | "illustration"
  | "map"
  | "document"
  | "engraving"
  | "artifact";

export type HistoricalImageAsset = {
  url: string;
  previewUrl?: string | null;
  caption: string;
  credit: string;
  source: HistoricalImageSource;
  sourcePageUrl: string;
  assetKind: HistoricalAssetKind;
  license?: string | null;
  matchScore?: number | null;
  resolvedAt: string;
};

export type TodayInHistorySelectionMeta = {
  editorialScore: number;
  imageScore: number;
  candidateCount: number;
  selectedRank: number;
  editorNotes: string[];
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
