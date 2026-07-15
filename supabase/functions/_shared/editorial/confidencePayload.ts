/**
 * Editorial confidence helpers — rescore and prune stored edition payloads.
 */

import type {
  DiscoveryItem,
  DiscoveryPayload,
  RankedDiscoveryItem,
} from "../discovery/types.ts";
import {
  computeDiscoveryConfidence,
  shouldPublishEditorialConfidence,
  type EditorialConfidence,
} from "./confidence.ts";

export function attachDiscoveryConfidence(
  item: DiscoveryItem,
  scoredAt?: string
): DiscoveryItem {
  return {
    ...item,
    editorialConfidence: computeDiscoveryConfidence(item, { scoredAt }),
  };
}

export function meetsDiscoveryConfidenceGate(item: DiscoveryItem): boolean {
  const confidence = item.editorialConfidence ?? computeDiscoveryConfidence(item);
  return shouldPublishEditorialConfidence(confidence);
}

/** Items scoring 70–79 that may improve after enrichment. */
export function discoveryItemsForEnrichment(
  items: DiscoveryItem[]
): DiscoveryItem[] {
  return items.filter((item) => {
    const confidence = computeDiscoveryConfidence(item);
    return confidence.action === "enrich";
  });
}

function filterRankedByConfidence(
  ranked: RankedDiscoveryItem[]
): RankedDiscoveryItem[] {
  return ranked
    .map((row) => ({
      ...row,
      item: attachDiscoveryConfidence(row.item),
    }))
    .filter((row) => shouldPublishEditorialConfidence(row.item.editorialConfidence!));
}

/**
 * Remove discovery picks that no longer meet the editorial confidence bar
 * after post-build enrichment (images, grounding, etc.).
 */
export function pruneDiscoveryPayloadByConfidence(
  payload: DiscoveryPayload
): DiscoveryPayload {
  const scoredAt = new Date().toISOString();
  const surfaces: DiscoveryPayload["surfaces"] = {};
  let selectedCount = 0;

  for (const [key, surface] of Object.entries(payload.surfaces)) {
    if (!surface) continue;
    const items = filterRankedByConfidence(surface.items).map((row) => ({
      ...row,
      item: attachDiscoveryConfidence(row.item, scoredAt),
    }));
    if (!items.length) continue;
    surfaces[key as keyof typeof surfaces] = { ...surface, items };
    selectedCount += items.length;
  }

  const picks: DiscoveryPayload["picks"] = [];
  const seen = new Set<string>();
  for (const result of Object.values(surfaces)) {
    if (!result) continue;
    for (const item of result.items) {
      if (seen.has(item.item.id)) continue;
      seen.add(item.item.id);
      picks.push({
        id: item.item.id,
        title: item.item.title,
        category: item.item.category,
        surface: result.surface,
        why: payload.picks.find((p) => p.id === item.item.id)?.why ?? "From today’s paper.",
      });
    }
  }

  const heldBack =
    payload.selectionMeta.enrichQueue?.filter((item) => {
      const confidence = attachDiscoveryConfidence(item, scoredAt).editorialConfidence!;
      return shouldPublishEditorialConfidence(confidence);
    }) ?? [];

  return {
    ...payload,
    surfaces,
    picks,
    selectionMeta: {
      ...payload.selectionMeta,
      selectedCount: selectedCount + heldBack.length,
      confidencePrunedAt: scoredAt,
      editorNotes: [
        ...payload.selectionMeta.editorNotes,
        heldBack.length
          ? `Promoted ${heldBack.length} listing(s) after enrichment rescoring.`
          : "",
        "Editorial confidence gate applied — weak listings withheld.",
      ].filter(Boolean),
    },
  };
}

export type { EditorialConfidence };
