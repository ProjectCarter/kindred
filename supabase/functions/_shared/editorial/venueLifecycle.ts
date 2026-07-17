/**
 * Kindred venue editorial lifecycle.
 * Server mirror — keep in sync with lib/edition/venueLifecycle.ts
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

export const VENUE_CONFIDENCE_PUBLISH_THRESHOLD = 70;
export const VENUE_CONFIDENCE_NEEDS_REVIEW_THRESHOLD = 50;

export const GUIDE_ELIGIBLE_LIFECYCLES: readonly VenueLifecycle[] = [
  "verified",
  "featured",
  "evergreen",
];

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
    return "needs_review";
  }

  if (confidenceScore < VENUE_CONFIDENCE_NEEDS_REVIEW_THRESHOLD) {
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

export function lifecycleAfterMissingFromSync(
  current: VenueLifecycle
): VenueLifecycle {
  if (current === "rejected" || current === "duplicate" || current === "closed") {
    return current;
  }
  return "needs_review";
}

export function lifecycleAfterConfirmedClosure(
  _current: VenueLifecycle
): VenueLifecycle {
  return "closed";
}

export function lifecycleFromLegacyStatus(status: string): VenueLifecycle {
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
