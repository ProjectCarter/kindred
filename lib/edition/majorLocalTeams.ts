/**
 * Major hometown teams — homepage presentation boost only.
 * Delegates to the location-aware hometownTeams catalog.
 */

import type { LocalEventCard } from "./localEvents";
import {
  HOMETOWN_TEAM_HOMEPAGE_BOOST,
  isHometownTeamEvent,
  resolveHometownTeamHomepageBoost,
  type HometownTeamTier,
} from "./hometownTeams";

export type MajorLocalTeamTier = HometownTeamTier;

/** @deprecated Use HOMETOWN_TEAM_HOMEPAGE_BOOST */
export const MAJOR_LOCAL_TEAM_HOMEPAGE_BOOST = HOMETOWN_TEAM_HOMEPAGE_BOOST;

/** Homepage-only editorial boost for major hometown teams in this edition's sports market. */
export function resolveMajorLocalTeamHomepageBoost(
  event: Pick<LocalEventCard, "name" | "venue" | "category">,
  sportsMarketId?: string | null
): number {
  return resolveHometownTeamHomepageBoost(event, sportsMarketId);
}

export function isMajorLocalTeamEvent(
  event: Pick<LocalEventCard, "name" | "venue" | "category">,
  sportsMarketId?: string | null
): boolean {
  return isHometownTeamEvent(event, sportsMarketId);
}
