/**
 * Instant edition helpers — validate and fingerprint cached bundles without
 * weakening readiness gates. Performance-only; no editorial changes.
 */

import type { EditionSection } from "./types";
import type { CachedEditionBundle } from "./editionCache";
import { assessEditionCompleteness } from "../perf/editionCompleteness";
import { localEditionDate } from "./dates";
import { resolveMorningHero, mergeMorningHeroIntoIntelligence } from "./resolveMorningHero";

/** Stable section identity for diffing cache vs network without full body compare. */
export function sectionsFingerprint(sections: EditionSection[]): string {
  return sections.map((s) => `${s.id}:${s.section_type}:${s.position}`).join("|");
}

/** Only paint a cached bundle that matches today and passes client completeness. */
export function isCachedEditionPaintable(
  bundle: CachedEditionBundle,
  editionDate: string = localEditionDate()
): boolean {
  if (bundle.editionDate !== editionDate) return false;
  if (!Array.isArray(bundle.sections) || bundle.sections.length === 0) {
    return false;
  }

  const morningHero = resolveMorningHero({
    intelligence: bundle.intelligence,
    cachedBundle: bundle,
  });

  const completeness = assessEditionCompleteness({
    sections: bundle.sections,
    intelligence: mergeMorningHeroIntoIntelligence(
      bundle.intelligence,
      morningHero
    ),
    bandit: bundle.bandit,
    leadStory: bundle.leadStory,
    readerLocation: null,
  });

  // Paint when the full paper is complete, or when narrative hero survived a
  // catalog-only partial rebuild (sections + masterpiece still on shelf).
  return completeness.complete || (Boolean(morningHero) && bundle.sections.length > 0);
}

/** True when network sections match what is already on screen from cache. */
export function networkSectionsMatchCache(
  cached: CachedEditionBundle | null,
  editionId: string,
  loaded: EditionSection[]
): boolean {
  if (!cached || cached.editionId !== editionId) return false;
  return sectionsFingerprint(cached.sections) === sectionsFingerprint(loaded);
}

/** Cached bundle points at a superseded edition row — discard before merge. */
export function isStaleCachedEdition(
  cached: CachedEditionBundle | null,
  editionId: string
): boolean {
  return Boolean(cached && cached.editionId !== editionId);
}
