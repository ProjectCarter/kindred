/**
 * Instant edition helpers — validate and fingerprint cached bundles without
 * blocking first paint on optional desks. Performance-only; no editorial changes.
 */

import type { EditionSection } from "./types";
import type { CachedEditionBundle } from "./editionCache";
import { calendarEditionDate } from "./editionDateGuard";

/** Stable section identity for diffing cache vs network without full body compare. */
export function sectionsFingerprint(sections: EditionSection[]): string {
  return sections.map((s) => `${s.id}:${s.section_type}:${s.position}`).join("|");
}

/**
 * Paint a cached bundle that matches today and has readable sections.
 * Optional desks (activities, recommendations, Bandit's Pick) must not
 * block leaving the loading screen.
 */
export function isCachedEditionPaintable(
  bundle: CachedEditionBundle,
  editionDate: string = calendarEditionDate(),
  metroKey?: string | null
): boolean {
  if (metroKey && bundle.metroKey !== metroKey) return false;
  if (bundle.editionDate !== editionDate) return false;
  return Array.isArray(bundle.sections) && bundle.sections.length > 0;
}

/** Cached bundle belongs to a prior calendar day — never paint as today's paper. */
export function isCachedEditionDateStale(
  bundle: CachedEditionBundle | null | undefined,
  calendarToday: string = calendarEditionDate()
): boolean {
  if (!bundle) return false;
  return bundle.editionDate !== calendarToday;
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
