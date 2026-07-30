import { useMemo } from "react";
import { EditorialCardGrid, type EditorialGridCard } from "./EditorialCardGrid";
import {
  dealCardSubtitle,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { useOfferSections } from "../lib/deals/useLocalDeals";
import { scopeSectionDeals } from "../lib/deals/offerClassification";
import { dealsSeeAllLabel } from "../lib/deals/dealCounts";

/** Compact homepage preview per scope — See All carries the rest. */
const PREVIEW_PER_SCOPE = 4;

type Props = {
  onOpenDeal?: (deal: LocalDeal) => void;
  onSeeAll?: () => void;
  /** Reader's metro key — decides which Local offers are eligible. */
  regionKey?: string | null;
};

/**
 * Offers — homepage desk. Renders the three-layer model (Local / Travel /
 * Online) the classification engine returns: one compact, emoji-first
 * EditorialCardGrid per non-empty scope, in the same rhythm as every other
 * homepage desk. This component contains NO classification logic — it only maps
 * the engine's sections to cards and renders them. Empty scopes are hidden on
 * the compact front page; when every scope is empty the whole desk renders
 * nothing (no header, no empty state). No photography on the front page
 * (permanent Kindred homepage law).
 */
export function LocalDealsSection({ onOpenDeal, onSeeAll, regionKey }: Props) {
  const { sections } = useOfferSections(regionKey);

  const byId = useMemo(() => {
    const map = new Map<string, LocalDeal>();
    for (const section of sections) {
      for (const deal of scopeSectionDeals(section)) map.set(deal.id, deal);
    }
    return map;
  }, [sections]);

  const visibleScopes = useMemo(
    () => sections.filter((section) => section.total > 0),
    [sections]
  );

  // Every scope empty (or still loading) → render nothing.
  if (visibleScopes.length === 0) return null;

  const openCard = onOpenDeal
    ? (card: EditorialGridCard) => {
        const deal = byId.get(card.id);
        if (deal) onOpenDeal(deal);
      }
    : undefined;

  return (
    <>
      {visibleScopes.map((section) => {
        const cards: EditorialGridCard[] = scopeSectionDeals(
          section,
          PREVIEW_PER_SCOPE
        ).map((deal) => ({
          id: deal.id,
          categoryIcon: deal.emoji,
          title: deal.title,
          subtitle: dealCardSubtitle(deal),
        }));

        return (
          <EditorialCardGrid
            key={section.scope}
            kicker={`${section.emoji} ${section.label}`}
            compact
            accentColor={LOCAL_DEALS_HOMEPAGE_ACCENT}
            cards={cards}
            initialRenderCount={PREVIEW_PER_SCOPE}
            seeAllTotal={section.total}
            onSeeAll={onSeeAll}
            seeAllLabel={dealsSeeAllLabel}
            analyticsSectionType="local_deals"
            onOpenCard={openCard}
          />
        );
      })}
    </>
  );
}
