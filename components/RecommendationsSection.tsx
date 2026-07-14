import { useMemo } from "react";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import { selectRecommendationCards } from "../lib/edition/recommendations";
import { EditorialCardGrid } from "./EditorialCardGrid";
import { RECOMMENDATIONS_GRID_LIMIT } from "../lib/edition/recommendationsListStore";

type Props = {
  items: RankedDiscoveryItem[];
  locationCity?: string | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
  /** Homepage first paint — rendering only. */
  initialRenderCount?: number;
  /** @deprecated Use initialRenderCount */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more items than fit. */
  onSeeAll?: () => void;
};

/**
 * Recommendations — "Where should I go?" Places worth discovering: coffee,
 * restaurants, bakeries, beaches, parks, museums, scenic drives, gardens.
 * Same grid, spacing, and "See More" rhythm as Local Events on purpose —
 * one paper, three desks, not three separate feeds.
 */
export function RecommendationsSection({
  items,
  locationCity,
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
    () => selectRecommendationCards(items, { city: locationCity }),
    [items, locationCity]
  );

  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker="Recommendations"
      cards={cards}
      initialRenderCount={initialRenderCount ?? limit}
      onSeeAll={cards.length > 0 ? onSeeAll : undefined}
      seeAllLabel={(n) => `See all ${n} recommendations`}
      emptyCopy="Nothing new to recommend nearby today — check back tomorrow."
      fallbackIcon="mappin.and.ellipse"
      fallbackIconIonicon="location-outline"
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
