/**
 * Resolve discovery from persisted edition surfaces — network intelligence,
 * cache bundle, or raw editions.discovery. Mirrors resolveMorningHero.ts.
 */

import type { CachedEditionBundle } from "./editionCache";
import { mergeFrozenSections } from "./editionFreeze";
import type { EditionSection } from "./types";
import type { EditionIntelligence } from "./surfaceIntelligence";
import {
  parseDiscoveryPayload,
  type DiscoveryPayload,
} from "./discovery";

export function discoverySurfaceItemCount(
  discovery: DiscoveryPayload | null | undefined
): number {
  if (!discovery?.surfaces) return 0;
  let count = 0;
  for (const surface of Object.values(discovery.surfaces)) {
    count += surface?.items?.length ?? 0;
  }
  return count;
}

export function hasUsableDiscovery(input: {
  intelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  discoveryRaw?: unknown;
}): boolean {
  if (discoverySurfaceItemCount(input.intelligence?.discovery) > 0) {
    return true;
  }
  if (
    discoverySurfaceItemCount(input.cachedBundle?.intelligence?.discovery) > 0
  ) {
    return true;
  }
  return discoverySurfaceItemCount(parseDiscoveryPayload(input.discoveryRaw)) > 0;
}

/** True when network edition has discovery the on-screen cache/state lacks. */
export function needsNetworkDiscoveryMerge(input: {
  networkIntelligence: EditionIntelligence | null;
  onScreenIntelligence?: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
  discoveryRaw?: unknown;
}): boolean {
  const networkCount = Math.max(
    discoverySurfaceItemCount(input.networkIntelligence?.discovery),
    discoverySurfaceItemCount(parseDiscoveryPayload(input.discoveryRaw))
  );
  if (networkCount === 0) return false;

  return !hasUsableDiscovery({
    intelligence: input.onScreenIntelligence,
    cachedBundle: input.cachedBundle,
  });
}

/** Section fingerprints can match while cached bodies are still empty shells. */
export function sectionsNeedNetworkBodyMerge(
  cached: EditionSection[],
  loaded: EditionSection[]
): boolean {
  if (!cached.length || !loaded.length) return false;
  const merged = mergeFrozenSections(cached, loaded);
  for (const type of ["local_events", "weather"] as const) {
    const before =
      cached.find((s) => s.section_type === type)?.body?.trim() ?? "";
    const after =
      merged.find((s) => s.section_type === type)?.body?.trim() ?? "";
    if (before !== after) return true;
  }
  return false;
}
