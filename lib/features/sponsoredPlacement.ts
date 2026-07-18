import type { ImageSourcePropType } from "react-native";

/** Fixed homepage slot — after Activities, before Recommendations. */
export const HOME_AFTER_ACTIVITIES_PLACEMENT_ID = "home_after_activities";

/**
 * Future-ready source kinds — no ad SDK wired yet.
 * - admob_native: Google AdMob Native Ads (future)
 * - direct_local: Local business sponsorship
 * - direct_national: National brand sponsorship
 * - house_announcement: Kindred house message
 * - preview_mock: Static dev preview only
 */
export type SponsoredPlacementSource =
  | "admob_native"
  | "direct_local"
  | "direct_national"
  | "house_announcement"
  | "preview_mock";

export type SponsoredPlacementContent = {
  placementId: string;
  sponsorName: string;
  headline: string;
  description: string;
  image: ImageSourcePropType;
  destinationUrl: string;
  sponsorLabel: string;
  source?: SponsoredPlacementSource;
};

/**
 * Global kill switch — keep `false` until sponsorship is ready to launch.
 * When false in production: no placement, no layout gap, no ad network calls.
 */
export const showSponsoredPlacement = false;

/**
 * Dev-only static preview. Consulted only when `__DEV__` is true, so production
 * builds never render mock sponsorship creative.
 */
export const previewSponsoredPlacement = true;

/** Static mock creative for development preview — not a live advertisement. */
export const SPONSORED_PLACEMENT_MOCK: SponsoredPlacementContent = {
  placementId: HOME_AFTER_ACTIVITIES_PLACEMENT_ID,
  sponsorName: "Desert Bloom Coffee",
  headline: "Warm seating and a quiet corner before the afternoon rush.",
  description:
    "Preview placement only — a neighborhood roaster, not a live sponsorship.",
  image: require("../../assets/discovery/recommendation-bakery.jpg"),
  destinationUrl: "https://kindred.app",
  sponsorLabel: "Sponsored",
  source: "preview_mock",
};

export function shouldRenderSponsoredPlacement(): boolean {
  if (showSponsoredPlacement) return true;
  if (__DEV__ && previewSponsoredPlacement) return true;
  return false;
}

/**
 * Resolves creative for a placement. Returns null when disabled or when no
 * content is available — callers must render nothing (no empty gap).
 */
export function resolveSponsoredPlacementContent(
  placementId: string = HOME_AFTER_ACTIVITIES_PLACEMENT_ID
): SponsoredPlacementContent | null {
  if (!shouldRenderSponsoredPlacement()) return null;
  if (placementId !== HOME_AFTER_ACTIVITIES_PLACEMENT_ID) return null;

  if (showSponsoredPlacement) {
    // Future: AdMob native loader, direct sponsorship feed, house announcements.
    return null;
  }

  if (__DEV__ && previewSponsoredPlacement) {
    return SPONSORED_PLACEMENT_MOCK;
  }

  return null;
}
