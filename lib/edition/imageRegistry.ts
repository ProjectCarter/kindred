/**
 * Cross-section image registry.
 *
 * Every desk (Activities, Recommendations, Experiences, Bandit's Notebook,
 * Bandit's Pick, Local Events fallbacks) used to pick its own photo
 * independently, each only avoiding repeats *within itself* — so the same
 * stock photograph could legitimately show up in Activities AND
 * Recommendations AND the Notebook in the same edition. This module gives
 * every desk one shared ledger for the current edition so a photo is never
 * repeated across the whole paper, and — just as important — the same
 * content item always gets the same photo on every re-render, so nothing
 * visibly changes while the reader is looking at it.
 */

import type { ImageSourcePropType } from "react-native";

/**
 * Tasteful, subject-neutral photography — safe to use for anything when we
 * don't have (or don't trust) a category-specific match. Never a beach,
 * skyline, or other specific scene that could misrepresent the venue.
 */
export const NEUTRAL_PLACEHOLDERS: ImageSourcePropType[] = [
  require("../../assets/heroes/hero-default-morning.jpg"),
  require("../../assets/heroes/hero-summer-sunrise.jpg"),
  require("../../assets/heroes/hero-autumn-leaves.jpg"),
  require("../../assets/heroes/hero-spring-flowers.jpg"),
];

let currentEditionKey: string | null = null;
let assignedByItemId = new Map<string, ImageSourcePropType>();
let usedImages = new Set<ImageSourcePropType>();

/**
 * Call once per edition (keyed by edition date or id) before any section
 * renders its cards. A no-op when the key hasn't changed — safe to call on
 * every render without disturbing already-assigned photos mid-session.
 */
export function resetImageRegistry(editionKey: string | null | undefined): void {
  const key = editionKey ?? "__unkeyed__";
  if (key === currentEditionKey) return;
  currentEditionKey = key;
  assignedByItemId = new Map();
  usedImages = new Set();
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Claim a photo for `id`. Same id always gets the same photo for the life
 * of this edition (stable across re-renders). A new id prefers its own
 * `pool`, rotating past anything another item already claimed; once that
 * pool is exhausted it borrows from `extraPool` (defaults to the neutral
 * placeholder rotation) before ever repeating an exact image.
 */
export function claimImage(
  id: string,
  pool: ImageSourcePropType[],
  extraPool: ImageSourcePropType[] = NEUTRAL_PLACEHOLDERS
): ImageSourcePropType {
  const already = assignedByItemId.get(id);
  if (already) return already;

  const safePool = pool.length > 0 ? pool : extraPool;
  const start = hashId(id) % safePool.length;

  for (let step = 0; step < safePool.length; step++) {
    const candidate = safePool[(start + step) % safePool.length];
    if (!usedImages.has(candidate)) {
      usedImages.add(candidate);
      assignedByItemId.set(id, candidate);
      return candidate;
    }
  }

  if (extraPool !== safePool) {
    const wideStart = hashId(id) % extraPool.length;
    for (let step = 0; step < extraPool.length; step++) {
      const candidate = extraPool[(wideStart + step) % extraPool.length];
      if (!usedImages.has(candidate)) {
        usedImages.add(candidate);
        assignedByItemId.set(id, candidate);
        return candidate;
      }
    }
  }

  // Every candidate already shown today — reuse rather than render nothing.
  const fallback = safePool[start] ?? extraPool[0];
  assignedByItemId.set(id, fallback);
  return fallback;
}

/** A subject-neutral placeholder, still deduped against everything else claimed today. */
export function claimPlaceholder(id: string): ImageSourcePropType {
  return claimImage(id, NEUTRAL_PLACEHOLDERS, NEUTRAL_PLACEHOLDERS);
}
