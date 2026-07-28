import { useMemo } from "react";
import { EditorialCardGrid, type EditorialGridCard } from "./EditorialCardGrid";
import {
  dealCardSubtitle,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { useFeaturedDeals } from "../lib/deals/useLocalDeals";
import { dealsSeeAllLabel } from "../lib/deals/dealCounts";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../lib/edition/editorialPublishing";

type Props = {
  onOpenDeal?: (deal: LocalDeal) => void;
  onSeeAll?: () => void;
  /** Reader's metro key — local deals for the metro plus nationwide/online. */
  regionKey?: string | null;
};

/**
 * Deals — homepage desk. Emoji-first, text-only compact rows on the cream page,
 * identical in rhythm to Local Events, Activities, and Food & Drinks (same
 * compact EditorialCardGrid, same spacing, own accent). Reads the published
 * catalog via the featured hook; hides entirely when there are zero deals. No
 * photography on the front page (permanent Kindred homepage law).
 */
export function LocalDealsSection({ onOpenDeal, onSeeAll, regionKey }: Props) {
  const { deals, totalCount } = useFeaturedDeals({ regionKey });

  const byId = useMemo(() => {
    const map = new Map<string, LocalDeal>();
    for (const deal of deals) map.set(deal.id, deal);
    return map;
  }, [deals]);

  const cards = useMemo<EditorialGridCard[]>(
    () =>
      deals.map((deal) => ({
        id: deal.id,
        categoryIcon: deal.emoji,
        title: deal.title,
        subtitle: dealCardSubtitle(deal),
      })),
    [deals]
  );

  // 0 deals (or still loading) → render nothing: no header, no empty state.
  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker="💰 Deals"
      compact
      accentColor={LOCAL_DEALS_HOMEPAGE_ACCENT}
      cards={cards}
      initialRenderCount={HOMEPAGE_INITIAL_RENDER_COUNT}
      seeAllTotal={totalCount || cards.length}
      onSeeAll={onSeeAll}
      seeAllLabel={dealsSeeAllLabel}
      analyticsSectionType="local_deals"
      onOpenCard={
        onOpenDeal
          ? (card) => {
              const deal = byId.get(card.id);
              if (deal) onOpenDeal(deal);
            }
          : undefined
      }
    />
  );
}
