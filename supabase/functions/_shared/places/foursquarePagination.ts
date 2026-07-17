/**
 * Foursquare Places Search pagination helpers.
 * @see https://docs.foursquare.com/fsq-developers-places/reference/pagination
 */

import type { NormalizedPlace } from "./types.ts";

/** Safety valve — 200 pages × 50 = 10,000 raw rows per category max. */
export const FOURSQUARE_MAX_PAGES = 200;

/** Parse the RFC 5988 Link header for rel="next". */
export function parseFoursquareNextPageUrl(
  linkHeader: string | null | undefined
): string | null {
  if (!linkHeader?.trim()) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/** Merge pages in relevance order — first sighting wins (page 1 before page 2). */
export function mergePlacesByProviderId(
  existing: NormalizedPlace[],
  incoming: NormalizedPlace[]
): NormalizedPlace[] {
  const seen = new Set(existing.map((p) => p.providerId));
  const merged = [...existing];
  for (const place of incoming) {
    if (seen.has(place.providerId)) continue;
    seen.add(place.providerId);
    merged.push(place);
  }
  return merged;
}

export type FoursquarePaginationStats = {
  pageCount: number;
  rawResultCount: number;
  uniquePlaceCount: number;
  stoppedReason: "complete" | "empty_page" | "max_pages" | "error";
};
