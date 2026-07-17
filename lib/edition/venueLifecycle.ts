/**
 * Kindred venue editorial lifecycle.
 *
 * NEW → Verified → Featured → Evergreen → Needs Review → Closed
 *
 * Nothing is permanently deleted — closed venues remain archived so historical
 * editions and saved links keep working.
 *
 * Keep in sync with supabase/functions/_shared/editorial/venueLifecycle.ts
 */

export type VenueLifecycle =
  | "new"
  | "verified"
  | "featured"
  | "evergreen"
  | "needs_review"
  | "closed"
  | "rejected"
  | "duplicate";

/** Minimum confidence to publish in the Food & Drink guide. */
export const VENUE_CONFIDENCE_PUBLISH_THRESHOLD = 70;

/** Below this, mark Needs Review instead of removing. */
export const VENUE_CONFIDENCE_NEEDS_REVIEW_THRESHOLD = 50;

/** Lifecycles eligible for the complete Food & Drink guide. */
export const GUIDE_ELIGIBLE_LIFECYCLES: readonly VenueLifecycle[] = [
  "verified",
  "featured",
  "evergreen",
];

/** Lifecycles eligible for homepage featured rotation (editor still curates 8). */
export const FEATURE_ELIGIBLE_LIFECYCLES: readonly VenueLifecycle[] = [
  "verified",
  "featured",
  "evergreen",
];

export function isGuideEligibleLifecycle(lifecycle: VenueLifecycle): boolean {
  return GUIDE_ELIGIBLE_LIFECYCLES.includes(lifecycle);
}

export function isFeatureEligibleLifecycle(lifecycle: VenueLifecycle): boolean {
  return FEATURE_ELIGIBLE_LIFECYCLES.includes(lifecycle);
}

export type LifecycleTransitionInput = {
  current: VenueLifecycle;
  confidenceScore: number;
  passesVerification: boolean;
  isNewDiscovery: boolean;
  missingFromFullSync: boolean;
};

/**
 * Derive lifecycle after a provider import or verification pass.
 * Featured / Evergreen are editorial promotions — never auto-demoted here.
 */
export function resolveLifecycleAfterImport(
  input: LifecycleTransitionInput
): VenueLifecycle {
  const { current, confidenceScore, passesVerification, isNewDiscovery, missingFromFullSync } =
    input;

  if (current === "rejected" || current === "duplicate") return current;
  if (current === "closed") return "closed";

  if (!passesVerification) {
    return isNewDiscovery ? "rejected" : current === "new" ? "rejected" : "needs_review";
  }

  if (missingFromFullSync) {
    if (current === "featured" || current === "evergreen") return "needs_review";
    return "needs_review";
  }

  if (confidenceScore < VENUE_CONFIDENCE_NEEDS_REVIEW_THRESHOLD) {
    if (current === "featured" || current === "evergreen") return "needs_review";
    return "needs_review";
  }

  if (isNewDiscovery) return "new";

  if (current === "new" && confidenceScore >= VENUE_CONFIDENCE_PUBLISH_THRESHOLD) {
    return "verified";
  }

  if (current === "needs_review" && confidenceScore >= VENUE_CONFIDENCE_PUBLISH_THRESHOLD) {
    return "verified";
  }

  if (current === "featured" || current === "evergreen") return current;

  if (confidenceScore >= VENUE_CONFIDENCE_PUBLISH_THRESHOLD) return "verified";

  return current === "new" ? "new" : "needs_review";
}

/** Full reconciliation: venue absent from all provider scans. */
export function lifecycleAfterMissingFromSync(
  current: VenueLifecycle
): VenueLifecycle {
  if (current === "rejected" || current === "duplicate" || current === "closed") {
    return current;
  }
  return "needs_review";
}

/** Editor-confirmed permanent closure — archive, never delete. */
export function lifecycleAfterConfirmedClosure(
  _current: VenueLifecycle
): VenueLifecycle {
  return "closed";
}

/** Map legacy catalog status values to lifecycle (migration helper). */
export function lifecycleFromLegacyStatus(
  status: string
): VenueLifecycle {
  switch (status) {
    case "active":
      return "verified";
    case "possibly_closed":
      return "needs_review";
    case "rejected":
      return "rejected";
    case "duplicate":
      return "duplicate";
    default:
      return "new";
  }
}
