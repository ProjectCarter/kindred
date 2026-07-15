/**
 * Client mirror — Today in History authentic image helpers.
 * Server resolver: supabase/functions/_shared/history/historicalImages.ts
 */

import type { KnowledgePayload } from "./knowledge";
import { parseKnowledgePayload } from "./knowledge";
import type { HistoricalImageAsset } from "./knowledgeGrounding";

export type { HistoricalImageAsset } from "./knowledgeGrounding";

/** Authentic historical image stored at edition build time. */
export function onThisDayImageFromKnowledge(
  knowledge: KnowledgePayload | unknown | null | undefined
): HistoricalImageAsset | null {
  const payload =
    knowledge && typeof knowledge === "object" && "byStoryKey" in knowledge
      ? (knowledge as KnowledgePayload)
      : parseKnowledgePayload(knowledge);
  const image = payload?.providerGrounding?.onThisDayImage;
  if (!image?.url?.trim()) return null;
  return image;
}
