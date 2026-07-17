import { useMemo } from "react";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import {
  FOOD_DRINK_SECTION_KICKER,
  FOOD_DRINK_SEE_ALL_LABEL,
  selectHomepageRecommendationCards,
} from "../lib/edition/recommendations";
import { EditorialCardGrid } from "./EditorialCardGrid";
import { RECOMMENDATIONS_GRID_LIMIT } from "../lib/edition/recommendationsListStore";
import type { ReaderLocation } from "../lib/edition/localDiscoveryScope";

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
 * Food & Drink — Kindred's daily guide to the best local places to eat and drink.
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
  const byId = useMemo(() => {
    const map = new Map<string, RankedDiscoveryItem>();
    for (const item of items) map.set(item.item.id, item);
    return map;
  }, [items]);

  const cards = useMemo(
    () =>
      selectHomepageRecommendationCards(items, {
        city: locationCity,
        readerLocation,
      }),
    [items, locationCity, readerLocation]
  );

  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker={FOOD_DRINK_SECTION_KICKER}
      cards={cards}
      initialRenderCount={initialRenderCount ?? limit}
      onSeeAll={cards.length > 0 ? onSeeAll : undefined}
      seeAllLabel={FOOD_DRINK_SEE_ALL_LABEL}
      emptyCopy="Nothing new on the Food & Drink desk this month — check back tomorrow."
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
