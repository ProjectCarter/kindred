import {
  resolveVerifiedEditorialCategory,
  type EditorialCategoryId,
} from "../../editorialCategory.ts";

export type KnowledgeContextKind =
  | "today_in_history"
  | "hero_artwork"
  | "discovery_briefing"
  | "news_entity";

/** Local everyday businesses — Wikipedia is not a grounding source here. */
const INELIGIBLE_EDITORIAL_CATEGORIES = new Set<EditorialCategoryId>([
  "restaurant",
  "coffee_shop",
  "bakery",
  "winery",
  "cocktail_bar",
  "brewery",
  "bowling_alley",
  "escape_room",
  "dog_park",
  "playground",
  "mini_golf",
  "arcade",
  "pickleball",
  "rock_climbing_gym",
  "market",
  "shopping_district",
  "farmers_market",
  "kayaking",
  "paddleboarding",
  "country_club",
  "bookstore",
  "golf_course",
  "rock_shop",
  "general_place",
]);

/** Museums, landmarks, historic sites, and similar cultural/geographic subjects. */
const ELIGIBLE_EDITORIAL_CATEGORIES = new Set<EditorialCategoryId>([
  "museum",
  "historic_site",
  "observation_deck",
  "botanical_garden",
  "zoo",
  "aquarium",
  "library",
  "theater",
  "scenic_lookout",
  "scenic_drive",
  "beach",
  "lake",
  "river",
  "farm",
  "park",
]);

const ELIGIBLE_NEWS_ENTITY_KINDS = new Set([
  "person",
  "organization",
  "place",
  "law",
  "event",
]);

export function isWikipediaEligible(input: {
  context: KnowledgeContextKind;
  title: string;
  entityKind?: string;
  discoveryCategory?: string | null;
  venueCategories?: string[] | null;
  dek?: string | null;
  address?: string | null;
}): boolean {
  const title = input.title?.trim() ?? "";
  if (title.length < 3) return false;

  if (input.context === "today_in_history" || input.context === "hero_artwork") {
    return true;
  }

  if (input.context === "news_entity") {
    if (!input.entityKind) return false;
    if (input.entityKind === "company" || input.entityKind === "term") {
      return false;
    }
    return ELIGIBLE_NEWS_ENTITY_KINDS.has(input.entityKind);
  }

  if (input.context === "discovery_briefing") {
    const verified = resolveVerifiedEditorialCategory({
      title: input.title,
      venueCategories: input.venueCategories,
      discoveryCategory: input.discoveryCategory,
      dek: input.dek,
      address: input.address,
    });

    if (INELIGIBLE_EDITORIAL_CATEGORIES.has(verified.categoryId)) {
      return false;
    }
    return ELIGIBLE_EDITORIAL_CATEGORIES.has(verified.categoryId);
  }

  return false;
}
