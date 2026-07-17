/**
 * Score Kindred venue records after catalog sync — respects editorial_lock.
 */

import {
  computeVenueEditorialScore,
  resolveVenueEditorialWithOverrides,
  venueEditorialScoreMaterialFingerprint,
  type KindredVenueEditorialScore,
  type VenueEditorialLabelId,
} from "../editorial/venueEditorialScore.ts";
import type { FoodDrinkCatalogRow } from "./foodDrinkCatalog.ts";
import type { NormalizedPlace } from "./types.ts";

export type VenueEditorialScorePatch = {
  editorial_score: number;
  editorial_labels: VenueEditorialLabelId[];
  editorial_reason: string;
  editorial_score_version: number;
  editorial_scored_at: string;
  editorial_score_evidence: KindredVenueEditorialScore["evidence"];
  editorial_score_previous?: number | null;
  editorial_score_change_reason?: string | null;
  editorial_score_material_fingerprint: string;
};

function isChainFromPlace(place: NormalizedPlace): boolean {
  return Boolean(place.providerCategories?.some((c) => /chain/i.test(c)));
}

export function buildVenueEditorialScoreInput(
  row: Partial<FoodDrinkCatalogRow> & {
    name: string;
    provider_categories?: string[];
    lifecycle: FoodDrinkCatalogRow["lifecycle"];
    verification_status: string;
    confidence_score: number;
  },
  place?: NormalizedPlace
): Parameters<typeof computeVenueEditorialScore>[0] {
  return {
    kindredVenueId: row.id ?? place?.providerId ?? "unknown",
    name: row.name,
    providerCategories: row.provider_categories ?? place?.providerCategories ?? [],
    editorialCategories: row.editorial_categories ?? [],
    editorialTeaser: row.editorial_teaser ?? row.note ?? place?.note,
    cuisine: row.cuisine ?? null,
    lifecycle: row.lifecycle,
    verificationStatus: row.verification_status,
    confidenceScore: row.confidence_score ?? 0,
    isChain: place ? isChainFromPlace(place) : undefined,
    providerRating: place?.rating ?? null,
    discoveredAt: row.discovered_at ?? null,
    isNewDiscovery: row.lifecycle === "new",
  };
}

export function scoreVenueEditorialRecord(input: {
  row: Partial<FoodDrinkCatalogRow> & {
    name: string;
    lifecycle: FoodDrinkCatalogRow["lifecycle"];
    verification_status: string;
    confidence_score: number;
    editorial_lock?: boolean;
    editorial_score_override?: number | null;
    editorial_labels_override?: VenueEditorialLabelId[] | null;
    editorial_reason_override?: string | null;
    editorial_score?: number;
    provider_categories?: string[];
  };
  place?: NormalizedPlace;
  now: string;
  previousFingerprint?: string | null;
  force?: boolean;
}): { patch: VenueEditorialScorePatch | null; computed: KindredVenueEditorialScore } {
  const scoreInput = buildVenueEditorialScoreInput(input.row, input.place);
  const computed = computeVenueEditorialScore(scoreInput);
  const resolved = resolveVenueEditorialWithOverrides(computed, {
    editorial_lock: input.row.editorial_lock,
    editorial_score_override: input.row.editorial_score_override,
    editorial_labels_override: input.row.editorial_labels_override,
    editorial_reason_override: input.row.editorial_reason_override,
  });

  const fingerprint = venueEditorialScoreMaterialFingerprint({
    name: input.row.name,
    providerCategories: scoreInput.providerCategories,
    editorialTeaser: scoreInput.editorialTeaser,
    cuisine: scoreInput.cuisine,
    lifecycle: input.row.lifecycle,
    confidenceScore: input.row.confidence_score ?? 0,
  });

  if (
    !input.force &&
    input.previousFingerprint &&
    input.previousFingerprint === fingerprint &&
    !input.row.editorial_lock
  ) {
    return { patch: null, computed: resolved };
  }

  if (input.row.editorial_lock) {
    return { patch: null, computed: resolved };
  }

  const previousScore = input.row.editorial_score ?? null;
  const scoreChanged = previousScore != null && previousScore !== resolved.score;

  return {
    patch: {
      editorial_score: resolved.score,
      editorial_labels: resolved.labels,
      editorial_reason: resolved.editorialReason,
      editorial_score_version: resolved.evidence.version,
      editorial_scored_at: input.now,
      editorial_score_evidence: resolved.evidence,
      editorial_score_previous: scoreChanged ? previousScore : undefined,
      editorial_score_change_reason: scoreChanged
        ? "material_evidence_or_lifecycle_change"
        : previousScore == null
        ? "initial_score"
        : null,
      editorial_score_material_fingerprint: fingerprint,
    },
    computed: resolved,
  };
}
