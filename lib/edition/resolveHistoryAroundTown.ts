/**
 * Resolve History Around Town from persisted edition surfaces — network row,
 * intelligence, or cache bundle. Mirrors resolveMorningHero.ts.
 */

import type { CachedEditionBundle } from "./editionCache";
import type { EditionIntelligence } from "./surfaceIntelligence";
import {
  parseHistoryAroundTownPayload,
  type HistoryAroundTownEditionPayload,
} from "./historyAroundTown/types";

export function resolveHistoryAroundTown(input: {
  intelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  historyAroundTown?: unknown;
}): HistoryAroundTownEditionPayload | null {
  const fromIntel = input.intelligence?.historyAroundTown ?? null;
  if (fromIntel?.places?.length) return fromIntel;

  const fromBundle = input.cachedBundle?.intelligence?.historyAroundTown ?? null;
  if (fromBundle?.places?.length) return fromBundle;

  return parseHistoryAroundTownPayload(input.historyAroundTown);
}

export function mergeHistoryAroundTownIntoIntelligence(
  intelligence: EditionIntelligence | null,
  historyAroundTown: HistoryAroundTownEditionPayload | null
): EditionIntelligence | null {
  if (!historyAroundTown?.places?.length) return intelligence;
  if (!intelligence) {
    return {
      discovery: null,
      knowledge: null,
      memory: null,
      morning: null,
      morningOpening: null,
      morningBriefing: null,
      morningHero: null,
      banditAside: null,
      memoryNote: null,
      discoveryItems: [],
      discoveryHeadline: "Worth your time",
      discoveryEditorNote: null,
      leadWhyThisMatters: null,
      leadWhyChosen: null,
      leadContinuityKicker: null,
      banditsPick: null,
      historyAroundTown,
    };
  }
  if (intelligence.historyAroundTown?.places?.length) return intelligence;
  return { ...intelligence, historyAroundTown };
}

export function mergeHistoryAroundTownIntoCachedBundle(
  bundle: CachedEditionBundle,
  historyAroundTown?: HistoryAroundTownEditionPayload | null
): CachedEditionBundle {
  const resolved =
    historyAroundTown ??
    resolveHistoryAroundTown({
      intelligence: bundle.intelligence,
      cachedBundle: bundle,
    });
  if (!resolved?.places?.length) return bundle;

  const intelligence = mergeHistoryAroundTownIntoIntelligence(
    bundle.intelligence,
    resolved
  );
  if (intelligence === bundle.intelligence) return bundle;

  return { ...bundle, intelligence };
}

/** True when network edition has History Around Town the on-screen cache/state lacks. */
export function needsNetworkHistoryAroundTownMerge(input: {
  networkIntelligence: EditionIntelligence | null;
  onScreenIntelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  historyAroundTown?: unknown;
}): boolean {
  const networkHistory = resolveHistoryAroundTown({
    intelligence: input.networkIntelligence,
    historyAroundTown: input.historyAroundTown,
  });
  if (!networkHistory?.places?.length) return false;

  const onScreenHistory = resolveHistoryAroundTown({
    intelligence: input.onScreenIntelligence,
    cachedBundle: input.cachedBundle,
  });
  return !onScreenHistory?.places?.length;
}
