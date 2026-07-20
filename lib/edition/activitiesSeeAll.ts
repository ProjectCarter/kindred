/**
 * Activities See All — one pool and one count for homepage footer + full list.
 * Mirrors foodDrinkSeeAll: count must match what sliceForSeeAll actually hands off.
 */

import type { RankedDiscoveryItem } from "./discovery.ts";
import { selectActivityCards } from "./activities.ts";
import {
  SEE_ALL_MAX_ITEMS,
  sliceForSeeAll,
} from "./editorialPublishing.ts";
import type { ReaderLocation } from "./localDiscoveryScope.ts";

function normalizeAddress(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\b(suite|ste|unit|#)\b.*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function venueLocationKey(item: RankedDiscoveryItem): string | null {
  const address = item.item.address?.trim();
  if (address) return `addr:${normalizeAddress(address)}`;

  const lat = item.item.lat;
  const lon = item.item.lon;
  if (typeof lat === "number" && typeof lon === "number") {
    return `geo:${lat.toFixed(4)},${lon.toFixed(4)}`;
  }
  return null;
}

/** Dedupe by id, then collapse name variants at the same verified address. */
export function dedupeActivitiesByVenue(
  items: readonly RankedDiscoveryItem[]
): RankedDiscoveryItem[] {
  const byId = new Map<string, RankedDiscoveryItem>();
  for (const item of items) {
    const id = item.item.id;
    if (!id || byId.has(id)) continue;
    byId.set(id, item);
  }

  const byLocation = new Map<string, RankedDiscoveryItem>();
  const out: RankedDiscoveryItem[] = [];

  for (const item of byId.values()) {
    const locationKey = venueLocationKey(item);
    if (!locationKey) {
      out.push(item);
      continue;
    }
    const existing = byLocation.get(locationKey);
    if (!existing) {
      byLocation.set(locationKey, item);
      out.push(item);
      continue;
    }
    const existingScore = existing.score ?? 0;
    const nextScore = item.score ?? 0;
    if (nextScore > existingScore) {
      const idx = out.indexOf(existing);
      if (idx >= 0) out[idx] = item;
      byLocation.set(locationKey, item);
    }
  }

  return out;
}

export function buildActivitiesSeeAllPool(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): RankedDiscoveryItem[] {
  const deduped = dedupeActivitiesByVenue(items ?? []);
  const cards = selectActivityCards(deduped, options);
  const cardIds = new Set(cards.map((c) => c.id));
  return deduped.filter((item) => cardIds.has(item.item.id));
}

/** Count shown in "See all N activities" — equals accessible list length (≤20). */
export function accessibleActivitiesSeeAllCount(
  items: readonly RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): number {
  return sliceForSeeAll(buildActivitiesSeeAllPool(items, options)).length;
}

export function logActivitiesCountDebug(input: {
  stage: string;
  rawActivityCount: number;
  validUniqueActivityCount: number;
  seeAllAccessibleCount: number;
}): void {
  if (!__DEV__) return;
  console.log("[activities-count-trace]", input);
}
