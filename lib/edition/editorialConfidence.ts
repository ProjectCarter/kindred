/**
 * Editorial Confidence — client mirror.
 * Scores are computed at edition build and stored on each item; never shown to readers.
 */

import type { DiscoveryItem } from "./discovery";

export type EditorialConfidenceAction = "publish" | "enrich" | "reject";

export type EditorialConfidence = {
  score: number;
  action: EditorialConfidenceAction;
  signals: Array<{ code: string; label: string; delta: number }>;
  completeness: boolean;
  verified: boolean;
  scoredAt: string;
};

export function shouldPublishEditorialConfidence(
  confidence: EditorialConfidence
): boolean {
  return confidence.action === "publish";
}

/** Secondary guard — prefer stored server confidence when present. */
export function meetsDiscoveryPublishConfidence(item: DiscoveryItem): boolean {
  const stored = (
    item as DiscoveryItem & { editorialConfidence?: EditorialConfidence | null }
  ).editorialConfidence;
  if (!stored) return true;
  return shouldPublishEditorialConfidence(stored);
}
