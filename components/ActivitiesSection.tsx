import { useMemo } from "react";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import { selectActivityCards } from "../lib/edition/activities";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../lib/edition/editorialPublishing";
import { EditorialCardGrid } from "./EditorialCardGrid";
import { ACTIVITIES_GRID_LIMIT } from "../lib/edition/activitiesListStore";

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
 * Activities — "What should I go do?" Real, bookable venues for active
 * participation. Same grid, spacing, and "See More" rhythm as Local
 * Events on purpose — one paper, three desks, not three separate feeds.
 */
export function ActivitiesSection({
  items,
  locationCity,
  readerLocation,
  onOpenItem,
  initialRenderCount = ACTIVITIES_GRID_LIMIT,
  limit,
  onSeeAll,
}: Props) {
  const byId = useMemo(() => {
    const map = new Map<string, RankedDiscoveryItem>();
    for (const item of items) map.set(item.item.id, item);
    return map;
  }, [items]);

  const cards = useMemo(
    () => selectActivityCards(items, { city: locationCity, readerLocation }),
    [items, locationCity, readerLocation]
  );

  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker="Activities"
      cards={cards}
      initialRenderCount={initialRenderCount ?? limit}
      onSeeAll={cards.length > 0 ? onSeeAll : undefined}
      seeAllLabel={(n) => `See all ${n} activities`}
      emptyCopy="Nothing new to try nearby this month — check back tomorrow."
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
