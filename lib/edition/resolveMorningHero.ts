/**
 * Resolve Today's Masterpiece from every persisted surface — intelligence,
 * cache bundle top-level field, or raw morning_edition JSON.
 *
 * Catalog sync and partial network payloads must never drop the hero when it
 * still exists on disk or in a prior edition row.
 */

import type { CachedEditionBundle } from "./editionCache";
import type { EditionIntelligence } from "./surfaceIntelligence";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { morningHeroFromEdition } from "./morningEdition";

export function resolveMorningHero(input: {
  intelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  morningEdition?: unknown;
}): MorningHeroExperience | null {
  const fromIntel = input.intelligence?.morningHero ?? null;
  if (fromIntel) return fromIntel;

  const fromBundle =
    input.cachedBundle?.morningHero ??
    input.cachedBundle?.intelligence?.morningHero ??
    null;
  if (fromBundle) return fromBundle;

  return morningHeroFromEdition({
    morning_edition: input.morningEdition,
  });
}

export function mergeMorningHeroIntoIntelligence(
  intelligence: EditionIntelligence | null,
  morningHero: MorningHeroExperience | null
): EditionIntelligence | null {
  if (!intelligence) {
    if (!morningHero) return null;
    return {
      discovery: null,
      knowledge: null,
      memory: null,
      morning: null,
      morningOpening: null,
      morningBriefing: null,
      morningHero,
      banditAside: null,
      memoryNote: null,
      discoveryItems: [],
      discoveryHeadline: "Worth your time",
      discoveryEditorNote: null,
      leadWhyThisMatters: null,
      leadWhyChosen: null,
      leadContinuityKicker: null,
      banditsPick: null,
    };
  }
  if (!morningHero || intelligence.morningHero) return intelligence;
  return { ...intelligence, morningHero };
}

export function mergeMorningHeroIntoCachedBundle(
  bundle: CachedEditionBundle
): CachedEditionBundle {
  const morningHero = resolveMorningHero({
    intelligence: bundle.intelligence,
    cachedBundle: bundle,
  });
  if (!morningHero) return bundle;

  return {
    ...bundle,
    morningHero,
    intelligence: mergeMorningHeroIntoIntelligence(bundle.intelligence, morningHero),
  };
}

export function needsMorningHeroRecovery(
  intelligence: EditionIntelligence | null,
  cachedBundle?: CachedEditionBundle | null
): boolean {
  return !resolveMorningHero({ intelligence, cachedBundle });
}

/** True when network edition has a hero the on-screen cache/state is missing. */
export function needsNetworkMorningHeroMerge(input: {
  networkIntelligence: EditionIntelligence | null;
  onScreenIntelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
}): boolean {
  const networkHero = resolveMorningHero({
    intelligence: input.networkIntelligence,
  });
  if (!networkHero) return false;

  const onScreenHero = resolveMorningHero({
    intelligence: input.onScreenIntelligence,
    cachedBundle: input.cachedBundle,
  });
  return !onScreenHero;
}
