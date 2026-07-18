import { useMemo } from "react";
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

type Props = {
  items: RankedDiscoveryItem[];
  locationCity?: string | null;
  readerLocation?: ReaderLocation | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
  /** Homepage first paint — rendering only. */
  initialRenderCount?: number;
  /** @deprecated Use initialRenderCount */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more items than fit. */
  onSeeAll?: () => void;
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

  if (!displayCards.length) {
    return null;
  }

  const showSeeAll = shouldShowFoodDrinksSeeAll({
    homepageVisibleCount: displayCards.length,
    poolItemCount: items.length,
    hasSeeAllHandler: Boolean(onSeeAll),
  });

  return (
    <EditorialCardGrid
      kicker={FOOD_DRINK_SECTION_KICKER}
      cards={displayCards}
      initialRenderCount={renderLimit}
      seeAllTotal={items.length}
      onSeeAll={showSeeAll ? onSeeAll : undefined}
      seeAllLabel={FOOD_DRINK_SEE_ALL_LABEL}
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
