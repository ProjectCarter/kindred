/**
 * Utility badges for Local Events — edition JSON carries finalized badge IDs only.
 * Inference logic lives in badgeResolver.ts (keep in sync with lib/edition/eventBadgeResolver.ts).
 */

export {
  BADGE_MIN_CONFIDENCE,
  BADGE_RULES,
  EVENT_INFO_BADGE_MAX,
  EVENT_INFO_BADGE_ORDER,
  applyBadgeConflicts,
  buildEventBadgeSignals,
  extractAiHintsFromBanditNote,
  inferAdmissionCost,
  inferVenueCategory,
  resolveEventBadgeCandidates,
  resolveEventBadges,
  type BadgeCandidate,
  type BadgeSignalTier,
  type EventBadgeSignalInput,
  type EventBadgeSignals,
  type EventCategory,
  type EventInfoBadgeId,
  type VenueCategory,
} from "./badgeResolver.ts";

import {
  buildEventBadgeSignals,
  resolveEventBadges,
  type EventCategory,
  type EventInfoBadgeId,
} from "./badgeResolver.ts";

/** @deprecated Prefer buildEventBadgeSignals + resolveEventBadges. */
export type EventBadgeInferenceInput = {
  name: string;
  venue: string;
  date?: string;
  time?: string;
  category?: EventCategory;
  hasTicketListing?: boolean;
  description?: string | null;
  banditNote?: string | null;
  ticketLinkType?: "tickets" | "more_info" | null;
  ticketProviders?: string[];
  priceText?: string | null;
  extractedPrice?: number | null;
};

export function inferEventInfoBadges(
  input: EventBadgeInferenceInput
): EventInfoBadgeId[] {
  return resolveEventBadges(buildEventBadgeSignals(input));
}
