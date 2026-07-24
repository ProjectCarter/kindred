import { useMemo } from "react";
import { EditorialCardGrid, type EditorialGridCard } from "./EditorialCardGrid";
import {
  allLocalDeals,
  dealCardSubtitle,
  featuredLocalDeals,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../lib/edition/editorialPublishing";

type Props = {
  onOpenDeal?: (deal: LocalDeal) => void;
  onSeeAll?: () => void;
};

/**
 * Local Deals — homepage desk. Emoji-first, text-only compact rows on the cream
 * page, identical in rhythm to Local Events, Activities, and Food & Drinks. No
 * photography on the front page (permanent Kindred homepage law); imagery appears
 * only after the reader taps "See all".
 */
export function LocalDealsSection({ onOpenDeal, onSeeAll }: Props) {
  const deals = useMemo(() => featuredLocalDeals(HOMEPAGE_INITIAL_RENDER_COUNT), []);
  const totalCount = useMemo(() => allLocalDeals().length, []);

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

  if (!cards.length) return null;

  return (
    <EditorialCardGrid
      kicker="💰 Local Deals"
      compact
      accentColor={LOCAL_DEALS_HOMEPAGE_ACCENT}
      cards={cards}
      initialRenderCount={HOMEPAGE_INITIAL_RENDER_COUNT}
      seeAllTotal={totalCount}
      onSeeAll={onSeeAll}
      seeAllLabel={(n) => `See all ${n} deals`}
      analyticsSectionType="local_deals"
      emptyCopy="Fresh local savings are on the way — check back tomorrow."
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
