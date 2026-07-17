/**
 * TEMP(Phase One perf): cold-launch acceptance helper.
 *
 * First paint under 5s is not success unless the already-generated edition
 * arrived complete — Activities, Recommendations, Today in History, etc.
 */

import type { EditionSection } from "../edition/types";
import type { LeadStory } from "../edition/LeadStory";
import type { BanditPayload } from "../edition/bandit";
import { banditsPick } from "../edition/bandit";
import type { EditionIntelligence } from "../edition/surfaceIntelligence";
import { allocateDiscoverySections } from "../edition/sectionAllocator";
import type { ReaderLocation } from "../edition/localDiscoveryScope";

export type EditionCompleteness = {
  complete: boolean;
  missing: string[];
  sectionTypes: string[];
  hasDiscovery: boolean;
  discoverySurfaceCount: number;
  activityCount: number;
  recommendationCount: number;
  hasHistory: boolean;
  hasLocalEvents: boolean;
  hasLookingAhead: boolean;
  hasBanditsPick: boolean;
  hasLeadStory: boolean;
  hasMorningHero: boolean;
  hasStoryOf: boolean;
};

const EXPECTED_SECTION_TYPES = [
  "local_events",
  "today_in_history",
] as const;

export function assessEditionCompleteness(input: {
  sections: EditionSection[];
  intelligence: EditionIntelligence | null;
  bandit: BanditPayload | null;
  leadStory: LeadStory | null;
  readerLocation?: ReaderLocation | null;
  expectStoryOf?: boolean;
}): EditionCompleteness {
  const sectionTypes = input.sections.map((s) => s.section_type);
  const hasLocalEvents = sectionTypes.includes("local_events");
  const hasHistory = sectionTypes.includes("today_in_history");
  const hasLookingAhead = sectionTypes.includes("looking_ahead");
  const hasStoryOf =
    sectionTypes.includes("story_of") || sectionTypes.includes("your_city");
  const discovery = input.intelligence?.discovery ?? null;
  const hasDiscovery = Boolean(discovery?.surfaces);
  const discoverySurfaceCount = discovery?.surfaces
    ? Object.keys(discovery.surfaces).length
    : 0;

  const allocation = allocateDiscoverySections(
    discovery,
    input.intelligence?.discoveryItems,
    {
      max: Infinity,
      readerLocation: input.readerLocation ?? null,
    }
  );

  const hasBanditsPick = Boolean(banditsPick(input.bandit));
  const hasLeadStory = Boolean(input.leadStory?.headline?.trim());
  const hasMorningHero = Boolean(input.intelligence?.morningHero);

  const missing: string[] = [];
  for (const type of EXPECTED_SECTION_TYPES) {
    if (!sectionTypes.includes(type)) missing.push(`section:${type}`);
  }
  if (!hasDiscovery) missing.push("discovery_payload");
  if (allocation.activities.length === 0) missing.push("activities");
  if (allocation.recommendations.length === 0) {
    missing.push("recommendations");
  }
  if (!hasBanditsPick) missing.push("bandits_pick");
  if (!hasLeadStory) missing.push("lead_story");
  if (!hasMorningHero) missing.push("morning_hero");
  if (input.expectStoryOf && !hasStoryOf) missing.push("story_of");

  return {
    // Core desks that define a readable Kindred morning paper.
    complete:
      hasLocalEvents &&
      hasHistory &&
      hasDiscovery &&
      allocation.activities.length > 0 &&
      allocation.recommendations.length > 0 &&
      hasBanditsPick &&
      (!input.expectStoryOf || hasStoryOf),
    missing,
    sectionTypes,
    hasDiscovery,
    discoverySurfaceCount,
    activityCount: allocation.activities.length,
    recommendationCount: allocation.recommendations.length,
    hasHistory,
    hasLocalEvents,
    hasLookingAhead,
    hasBanditsPick,
    hasLeadStory,
    hasMorningHero,
    hasStoryOf,
  };
}

export function logEditionCompleteness(
  context: string,
  report: EditionCompleteness
): void {
  if (report.complete) {
    console.log(`[perf:edition] complete${context ? ` (${context})` : ""}`, {
      sectionTypes: report.sectionTypes,
      activities: report.activityCount,
      recommendations: report.recommendationCount,
      discoverySurfaces: report.discoverySurfaceCount,
    });
    return;
  }

  console.warn(
    `[perf:edition] INCOMPLETE${context ? ` (${context})` : ""} — first paint is not Phase One success`,
    {
      missing: report.missing,
      sectionTypes: report.sectionTypes,
      activities: report.activityCount,
      recommendations: report.recommendationCount,
      discoverySurfaces: report.discoverySurfaceCount,
      hasDiscovery: report.hasDiscovery,
      hasHistory: report.hasHistory,
      hasLocalEvents: report.hasLocalEvents,
      hasBanditsPick: report.hasBanditsPick,
      hasLeadStory: report.hasLeadStory,
      hasMorningHero: report.hasMorningHero,
      hasStoryOf: report.hasStoryOf,
    }
  );
}
