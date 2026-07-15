/**
 * Authentic historical media for Today in History — never AI or stock substitutes.
 */

export type HistoricalImageSource =
  | "wikimedia_commons"
  | "wikipedia";

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
  /** Relevance score when resolved from Commons search. */
  matchScore?: number | null;
  /** When the asset was selected at edition build. */
  resolvedAt: string;
};

export type TodayInHistorySelectionMeta = {
  editorialScore: number;
  imageScore: number;
  candidateCount: number;
  selectedRank: number;
  editorNotes: string[];
};
