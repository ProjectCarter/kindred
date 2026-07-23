import { useEffect, useMemo } from "react";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import {
  FOOD_DRINK_SECTION_KICKER,
  FOOD_DRINK_SEE_ALL_LABEL,
  buildFallbackHomepageFoodDrinkCards,
  selectHomepageRecommendationCards,
} from "../lib/edition/recommendations";
import { EditorialCardGrid } from "./EditorialCardGrid";
import { RECOMMENDATIONS_GRID_LIMIT } from "../lib/edition/recommendationsListStore";
import type { ReaderLocation } from "../lib/edition/localDiscoveryScope";
import { shouldShowFoodDrinksSeeAll } from "../lib/edition/foodDrinksHomepage";
import {
  logFoodDrinkCountDebug,
  resolveFoodDrinkSeeAllPool,
} from "../lib/edition/foodDrinkSeeAll";

type Props = {
  items: RankedDiscoveryItem[];
  locationCity?: string | null;
  readerLocation?: ReaderLocation | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
  /** Homepage first paint — rendering only. */
  initialRenderCount?: number;
  /** @deprecated Use initialRenderCount */
  limit?: number;
  /** Present only on the front page — opens the full guide with the same pool. */
  onSeeAll?: (pool: RankedDiscoveryItem[]) => void;
};

/**
 * Food & Drinks — Kindred's daily guide to the best local places to eat and drink.
 * Same grid, spacing, and "See More" rhythm as Local Events on purpose —
 * one paper, distinct desks, not separate feeds.
 */
export function RecommendationsSection({
  items,
  locationCity,
  readerLocation,
  onOpenItem,
  initialRenderCount = RECOMMENDATIONS_GRID_LIMIT,
  limit,
  onSeeAll,
}: Props) {
  const renderLimit = initialRenderCount ?? limit;

  const byId = useMemo(() => {
    const map = new Map<string, RankedDiscoveryItem>();
    for (const item of items) map.set(item.item.id, item);
    return map;
  }, [items]);

  const seeAllPool = useMemo(
    () => resolveFoodDrinkSeeAllPool(items, readerLocation),
    [items, readerLocation]
  );

  const selectedCards = useMemo(
    () =>
      selectHomepageRecommendationCards(items, {
        city: locationCity,
        readerLocation,
      }),
    [items, locationCity, readerLocation]
  );

  const displayCards = useMemo(() => {
    if (selectedCards.length > 0) return selectedCards;
    if (!items.length) return [];
    return buildFallbackHomepageFoodDrinkCards(items, {
      city: locationCity,
      limit: renderLimit,
    });
  }, [selectedCards, items, locationCity, renderLimit]);

  const showSeeAll = shouldShowFoodDrinksSeeAll({
    homepageVisibleCount: displayCards.length,
    poolItemCount: seeAllPool.length,
    hasSeeAllHandler: Boolean(onSeeAll),
  });

  useEffect(() => {
    if (!displayCards.length) return;
    logFoodDrinkCountDebug({
      stage: "homepage_recommendations_section",
      uniqueBeforeFilter: items.length,
      uniqueAfterFilter: seeAllPool.length,
      homepageCount: seeAllPool.length,
      renderedCount: displayCards.length,
      paginationLimit: renderLimit,
    });
  }, [
    displayCards.length,
    items.length,
    seeAllPool.length,
    renderLimit,
  ]);

  if (!displayCards.length) {
    return null;
  }

  return (
    <EditorialCardGrid
      kicker={FOOD_DRINK_SECTION_KICKER}
      floatingCardTint="lavender"
      cards={displayCards}
      initialRenderCount={renderLimit}
      seeAllTotal={seeAllPool.length}
      onSeeAll={
        showSeeAll
          ? () => {
              if (__DEV__) {
                logFoodDrinkCountDebug({
                  stage: "see_all_handoff",
                  uniqueBeforeFilter: items.length,
                  uniqueAfterFilter: seeAllPool.length,
                  homepageCount: seeAllPool.length,
                  fullListHandoffCount: seeAllPool.length,
                  renderedCount: displayCards.length,
                  paginationLimit: null,
                });
              }
              onSeeAll?.(seeAllPool);
            }
          : undefined
      }
      seeAllLabel={FOOD_DRINK_SEE_ALL_LABEL}
      analyticsSectionType="recommendations"
      emptyCopy="Nothing new on the Food & Drinks desk this month — check back tomorrow."
      onOpenCard={
        onOpenItem
          ? (card) => {
              const item = byId.get(card.id);
              if (item) onOpenItem(item);
            }
          : undefined
      }
    />
  );
}
