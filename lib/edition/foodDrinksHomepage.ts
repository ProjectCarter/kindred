/**
 * Food & Drinks homepage desk — See All footer and visibility helpers.
 */

import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing.ts";

export function foodDrinksSeeAllLabel(count: number): string {
  return `See all ${count} Food & Drinks`;
}

/** Show footer whenever the desk has a pool and a navigation handler. */
export function shouldShowFoodDrinksSeeAll(input: {
  homepageVisibleCount: number;
  poolItemCount: number;
  hasSeeAllHandler: boolean;
}): boolean {
  void input.homepageVisibleCount;
  if (!input.hasSeeAllHandler || input.poolItemCount <= 0) return false;
  return true;
}

/** EditorialCardGrid See All footer — always when the desk has items to open. */
export function shouldShowEditorialSeeAllFooter(input: {
  hasHandler: boolean;
  visibleCount: number;
  seeAllTotal?: number;
  cardCount: number;
}): boolean {
  void input.visibleCount;
  if (!input.hasHandler) return false;
  const total = input.seeAllTotal ?? input.cardCount;
  return total > 0;
}

export function editorialSeeAllFooterLabel(
  total: number,
  label: (count: number) => string
): string {
  return label(total);
}

export function homepageFoodDrinksVisibleCount(
  homepageCardCount: number,
  poolItemCount: number
): number {
  if (homepageCardCount <= 0) return 0;
  return Math.min(
    homepageCardCount,
    poolItemCount,
    HOMEPAGE_INITIAL_RENDER_COUNT
  );
}
