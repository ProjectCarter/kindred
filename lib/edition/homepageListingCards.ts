/**
 * Homepage listing desks — map edition payloads to EditorialGridCard rows.
 * Typography-first folio cards; photography opens only in the article reader.
 */

import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import type { BanditsPick } from "./bandit";
import type { RankedDiscoveryItem } from "./discovery";
import type { LocalEventCard } from "./localEvents";
import { eventDisplayHeadline } from "./localEvents";
import { resolveEventCategoryIcon } from "./categoryIcon";
import { eventInfoBadgesFor, type EventInfoBadgeId } from "./eventBadges";

export type HomepageListingCard = EditorialGridCard & {
  badges?: readonly EventInfoBadgeId[];
};

export function localEventListingCard(
  event: LocalEventCard,
  sportsMarketId?: string | null
): HomepageListingCard {
  const categoryIcon =
    event.category === "sports"
      ? resolveEventCategoryIcon(
          {
            name: event.name,
            venue: event.venue,
            category: event.category,
          },
          { sportsMarketId }
        )
      : event.categoryIcon ??
        resolveEventCategoryIcon({
          name: event.name,
          venue: event.venue,
          category: event.category,
        });

  return {
    id: `${event.name}::${event.date}::${event.venue}`,
    categoryIcon,
    title: eventDisplayHeadline(event),
    subtitle: event.city?.trim() || null,
    note: event.banditNote?.trim() || null,
    badges: eventInfoBadgesFor(event),
  };
}

export function banditsPickToListingCards(input: {
  pick: BanditsPick;
  mainCategoryIcon?: string | null;
  sides: readonly RankedDiscoveryItem[];
  sideCategoryIconsById?: ReadonlyMap<string, string | null | undefined>;
}): HomepageListingCard[] {
  const cards: HomepageListingCard[] = [
    {
      id: input.pick.story.id,
      categoryIcon: input.mainCategoryIcon ?? "🐕",
      title: input.pick.story.headline,
      note: input.pick.story.summary?.trim() || null,
      subtitle:
        input.pick.kind === "article" && input.pick.story.source
          ? input.pick.story.source.trim()
          : "Bandit",
    },
  ];

  for (const side of input.sides) {
    cards.push({
      id: side.item.id,
      categoryIcon:
        input.sideCategoryIconsById?.get(side.item.id) ?? null,
      title: side.item.title,
      subtitle: side.item.place?.city?.trim() ?? side.item.source?.name ?? null,
    });
  }

  return cards;
}
