import { useMemo } from "react";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import { selectActivityCards } from "../lib/edition/activities";
import { EditorialCardGrid } from "./EditorialCardGrid";
import { ACTIVITIES_GRID_LIMIT } from "../lib/edition/activitiesListStore";

type Props = {
  items: RankedDiscoveryItem[];
  locationCity?: string | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
  /** Front page caps at ACTIVITIES_GRID_LIMIT; the full list screen passes a larger value. */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more items than fit. */
  onSeeAll?: () => void;
};

/**
 * Activities — "What should I go do?" Real, bookable venues for active
 * participation. Same grid, spacing, and "See More" rhythm as Local
 * Events on purpose — one paper, three desks, not three separate feeds.
 */
export function ActivitiesSection({
  items,
  locationCity,
  onOpenItem,
  limit = ACTIVITIES_GRID_LIMIT,
  onSeeAll,
}: Props) {
  const byId = useMemo(() => {
    const map = new Map<string, RankedDiscoveryItem>();
    for (const item of items) map.set(item.item.id, item);
    return map;
  }, [items]);

  const cards = useMemo(
    () => selectActivityCards(items, { city: locationCity }),
    [items, locationCity]
  );

  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker="Activities"
      cards={cards}
      limit={limit}
      onSeeAll={cards.length > 0 ? onSeeAll : undefined}
      seeAllLabel={(n) => `See all ${n} activities`}
      emptyCopy="Nothing new to try nearby today — check back tomorrow."
      fallbackIcon="figure.run"
      fallbackIconIonicon="walk-outline"
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
