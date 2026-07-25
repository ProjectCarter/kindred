/**
 * Discovery Quality Filter — Kindred Constitutional Amendment V3 (server).
 *
 * The single eligibility gate every discovery pipeline runs BEFORE editorial
 * ranking. It does not rank or score — it decides whether a listing is even
 * allowed to be recommended. It consolidates the existing category/eligibility
 * checks into one place so every surface (Activities, Food & Drinks, Local Deals,
 * Events, Recommendations, and any future desk) applies the same constitutional
 * rules:
 *
 *   • Constitutionally restricted businesses — firearms/weapons/tactical/ammo/
 *     knife/survival, cannabis dispensaries, vape/smoke/tobacco/hookah, gambling,
 *     adult-oriented, and permanently-closed markers (restrictedBusinessFilter).
 *   • Everyday service / office / industrial businesses that are not destinations
 *     (serviceBusinessFilter).
 *   • Family-friendly editorial exclusions — adult / hate / violence / scam
 *     (familyFriendlyFilter).
 *
 * Numeric confidence/verification eligibility ("low-confidence → exclude") is
 * enforced by the existing, already-universal confidence gate
 * (meetsDiscoveryConfidenceGate / shouldPublishEditorialConfidence) that every
 * pipeline already applies alongside this filter — this module deliberately does
 * NOT re-implement scoring.
 *
 * Server counterpart of `lib/edition/discoveryQualityFilter.ts`.
 */

import { assessServiceBusinessListing } from "./serviceBusinessFilter.ts";
import { assessRestrictedBusinessListing } from "./restrictedBusinessFilter.ts";
import { isEditoriallyExcludedListing } from "../localEvents/familyFriendlyFilter.ts";

export type DiscoveryQualityInput = {
  name: string;
  venueCategories?: string[] | null;
  category?: string | null;
  dek?: string | null;
  description?: string | null;
  tags?: string[] | null;
};

export type DiscoveryQualityAssessment = {
  eligible: boolean;
  /** Diagnostics only — never reader-facing. */
  reason?: string;
  category?: string;
};

function qualityHay(input: DiscoveryQualityInput): string {
  return [
    input.name,
    ...(input.venueCategories ?? []),
    input.category,
    input.dek,
    input.description,
    ...(input.tags ?? []),
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ");
}

/**
 * Decide whether a listing may be recommended in any discovery surface.
 * When in doubt Kindred excludes — but each underlying check has its own
 * food/experience safe harbor so real destinations are never removed by accident.
 */
export function assessDiscoveryQuality(
  input: DiscoveryQualityInput
): DiscoveryQualityAssessment {
  const restricted = assessRestrictedBusinessListing(input);
  if (restricted.excluded) {
    return {
      eligible: false,
      reason: restricted.signal,
      category: restricted.category,
    };
  }

  const service = assessServiceBusinessListing(input);
  if (service.excluded) {
    return {
      eligible: false,
      reason: service.signal,
      category: "service_business",
    };
  }

  const editorial = isEditoriallyExcludedListing(qualityHay(input));
  if (editorial.excluded) {
    return {
      eligible: false,
      reason: editorial.signal,
      category: editorial.category,
    };
  }

  return { eligible: true };
}

/** True when a listing must never be recommended (V3 constitutional exclusion). */
export function isDiscoveryQualityExcluded(
  input: DiscoveryQualityInput
): boolean {
  return !assessDiscoveryQuality(input).eligible;
}
