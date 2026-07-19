/**
 * Kindred Visual Language — icon resolution for events, discovery, and Bandit's Pick.
 * Classification flows through editorialEmojiCatalog (most specific wins).
 *
 * Canonical law: .cursor/rules/kindred-visual-language.mdc
 */

import type { LocalEventCategory } from "./localEvents";
import { resolveSportEventIcon, SPORT_EVENT_ICON_FALLBACK } from "./sportEventIcon";
import type { DiscoveryCategory, DiscoveryItem } from "./discovery";
import type { EditorialCategoryId } from "./editorialCategory";
import type { BanditsPickKind } from "./bandit";
import {
  isFoodDrinkDiscoveryItem,
  resolveFoodDrinkCuisineEmoji,
} from "./foodDrinkCuisineEmoji";
import {
  CATEGORY_ICON_DICTIONARY,
  CATEGORY_ICON_FALLBACK,
  EDITORIAL_EMOJI,
  EDITORIAL_EMOJI_SECTION_FALLBACK,
  LOCAL_EVENT_SECTION_EMOJI,
  hayFromParts,
  resolveEditorialEmojiFromHay,
  resolveEditorialVenueEmoji,
} from "./editorialEmojiCatalog";

export {
  CATEGORY_ICON_DICTIONARY,
  CATEGORY_ICON_FALLBACK,
  EDITORIAL_EMOJI,
} from "./editorialEmojiCatalog";

export type CategoryIconContext = "event" | "activity" | "recommendation" | "bandits_pick";

type HayInput = {
  title?: string | null;
  venue?: string | null;
  dek?: string | null;
  venueCategories?: string[] | null;
  tags?: string[] | null;
};

function hayFrom(input: HayInput): string {
  return hayFromParts([
    input.title,
    input.venue,
    input.dek,
    ...(input.venueCategories ?? []),
    ...(input.tags ?? []),
  ]);
}

const DISCOVERY_CATEGORY_FALLBACK: Partial<Record<DiscoveryCategory, string>> = {
  coffee: EDITORIAL_EMOJI.coffee,
  restaurants: EDITORIAL_EMOJI.food_dining,
  bakeries: EDITORIAL_EMOJI.bakery,
  beaches: EDITORIAL_EMOJI.beach,
  hiking: EDITORIAL_EMOJI.hiking,
  parks: EDITORIAL_EMOJI.park,
  scenic_drives: EDITORIAL_EMOJI.scenic_view,
  museums: EDITORIAL_EMOJI.museum,
  books: EDITORIAL_EMOJI.literature,
  movies: EDITORIAL_EMOJI.film,
  podcasts: EDITORIAL_EMOJI.library,
  recipes: EDITORIAL_EMOJI.food_dining,
  experiences: EDITORIAL_EMOJI.festival,
  travel: EDITORIAL_EMOJI.aviation,
  activities: EDITORIAL_EMOJI.festival,
  gardens: EDITORIAL_EMOJI.botanical_garden,
};

const EDITORIAL_CATEGORY_ICON: Partial<Record<EditorialCategoryId, string>> = {
  restaurant: EDITORIAL_EMOJI.food_dining,
  coffee_shop: EDITORIAL_EMOJI.coffee,
  bakery: EDITORIAL_EMOJI.bakery,
  winery: EDITORIAL_EMOJI.winery,
  cocktail_bar: EDITORIAL_EMOJI.cocktails,
  brewery: EDITORIAL_EMOJI.brewery,
  park: EDITORIAL_EMOJI.park,
  dog_park: EDITORIAL_EMOJI.dog_park,
  playground: EDITORIAL_EMOJI.playground,
  museum: EDITORIAL_EMOJI.museum,
  historic_site: EDITORIAL_EMOJI.historic_site,
  botanical_garden: EDITORIAL_EMOJI.botanical_garden,
  beach: EDITORIAL_EMOJI.beach,
  lake: EDITORIAL_EMOJI.lake_river,
  river: EDITORIAL_EMOJI.lake_river,
  scenic_lookout: EDITORIAL_EMOJI.scenic_view,
  observation_deck: EDITORIAL_EMOJI.scenic_view,
  scenic_drive: EDITORIAL_EMOJI.scenic_view,
  library: EDITORIAL_EMOJI.library,
  bookstore: EDITORIAL_EMOJI.literature,
  arcade: EDITORIAL_EMOJI.arcade,
  bowling_alley: EDITORIAL_EMOJI.bowling,
  mini_golf: EDITORIAL_EMOJI.mini_golf,
  escape_room: EDITORIAL_EMOJI.escape_room,
  rock_climbing_gym: EDITORIAL_EMOJI.rock_climbing,
  golf_course: EDITORIAL_EMOJI.golf,
  pickleball: EDITORIAL_EMOJI.pickleball,
  zoo: EDITORIAL_EMOJI.museum,
  aquarium: EDITORIAL_EMOJI.museum,
  farm: EDITORIAL_EMOJI.farmers_market,
  farmers_market: EDITORIAL_EMOJI.farmers_market,
  shopping_district: EDITORIAL_EMOJI.shopping,
  market: EDITORIAL_EMOJI.shopping,
  kayaking: EDITORIAL_EMOJI.water_sports,
  paddleboarding: EDITORIAL_EMOJI.water_sports,
  theater: EDITORIAL_EMOJI.theater,
  country_club: EDITORIAL_EMOJI.golf,
  rock_shop: EDITORIAL_EMOJI.shopping,
  general_place: EDITORIAL_EMOJI_SECTION_FALLBACK,
};

const ACTIVITY_SUBTYPE_ICON: Record<string, string> = {
  hiking: EDITORIAL_EMOJI.hiking,
  water_recreation: EDITORIAL_EMOJI.water_sports,
  rock_climbing: EDITORIAL_EMOJI.rock_climbing,
  pickleball: EDITORIAL_EMOJI.pickleball,
  karaoke: EDITORIAL_EMOJI.live_music,
  arcades: EDITORIAL_EMOJI.arcade,
  bowling: EDITORIAL_EMOJI.bowling,
  mini_golf: EDITORIAL_EMOJI.mini_golf,
  escape_rooms: EDITORIAL_EMOJI.escape_room,
  go_karts: EDITORIAL_EMOJI.go_karts,
};

/**
 * Resolve event emoji — specific text → sport desk → section category → 🎉.
 * 🤝 appears only when editorialEmojiCatalog matches genuine networking.
 */
export function resolveEventCategoryIcon(
  input: {
    name: string;
    venue?: string | null;
    category?: LocalEventCategory | null;
    dek?: string | null;
  },
  options?: {
    sportsMarketId?: string | null;
  }
): string {
  const venueIcon = resolveEditorialVenueEmoji(input.venue);
  if (venueIcon) return venueIcon;

  if (input.category === "sports") {
    const sportIcon = resolveSportEventIcon(input, options);
    if (sportIcon) return sportIcon;
    return SPORT_EVENT_ICON_FALLBACK;
  }

  const hay = hayFrom({
    title: input.name,
    venue: input.venue,
    dek: input.dek,
  });
  const fromText = resolveEditorialEmojiFromHay(hay);
  if (fromText) return fromText;

  if (input.category) return LOCAL_EVENT_SECTION_EMOJI[input.category];
  return EDITORIAL_EMOJI_SECTION_FALLBACK;
}

export function resolveDiscoveryCategoryIcon(
  item: Pick<
    DiscoveryItem,
    "title" | "dek" | "category" | "venueCategories" | "tags"
  > & {
    editorialCategoryId?: EditorialCategoryId | null;
    activitySubtype?: string | null;
  },
  context: CategoryIconContext
): string {
  const venueIcon = resolveEditorialVenueEmoji(item.title);
  if (venueIcon) return venueIcon;

  if (isFoodDrinkDiscoveryItem(item, context)) {
    return resolveFoodDrinkCuisineEmoji(item);
  }

  if (item.editorialCategoryId && EDITORIAL_CATEGORY_ICON[item.editorialCategoryId]) {
    return EDITORIAL_CATEGORY_ICON[item.editorialCategoryId]!;
  }

  const hay = hayFrom(item);
  const fromText = resolveEditorialEmojiFromHay(hay);
  if (fromText) return fromText;

  if (item.activitySubtype && ACTIVITY_SUBTYPE_ICON[item.activitySubtype]) {
    return ACTIVITY_SUBTYPE_ICON[item.activitySubtype]!;
  }

  const discoveryFallback = DISCOVERY_CATEGORY_FALLBACK[item.category];
  if (discoveryFallback) return discoveryFallback;

  void context;
  return EDITORIAL_EMOJI_SECTION_FALLBACK;
}

export function resolveBanditsPickCategoryIcon(input: {
  kind: BanditsPickKind;
  headline: string;
  summary?: string | null;
  category?: string | null;
  discoveryItem?: Pick<
    DiscoveryItem,
    "title" | "dek" | "category" | "venueCategories" | "tags"
  > | null;
}): string {
  if (input.discoveryItem) {
    return resolveDiscoveryCategoryIcon(
      {
        title: input.discoveryItem.title,
        dek: input.discoveryItem.dek,
        category: input.discoveryItem.category,
        venueCategories: input.discoveryItem.venueCategories,
        tags: input.discoveryItem.tags,
      },
      input.kind === "event"
        ? "event"
        : input.kind === "activity"
          ? "activity"
          : "bandits_pick"
    );
  }

  if (input.kind === "event") {
    return resolveEventCategoryIcon({
      name: input.headline,
      venue: input.summary,
      category: null,
    });
  }

  const fromText = resolveEditorialEmojiFromHay(
    hayFrom({ title: input.headline, dek: input.summary })
  );
  if (fromText) return fromText;

  const kindFallback: Partial<Record<BanditsPickKind, string>> = {
    activity: EDITORIAL_EMOJI.festival,
    place: EDITORIAL_EMOJI.food_dining,
    hidden_gem: EDITORIAL_EMOJI.nature_preserve,
    seasonal: EDITORIAL_EMOJI.festival,
    article: EDITORIAL_EMOJI.library,
  };
  return kindFallback[input.kind] ?? EDITORIAL_EMOJI_SECTION_FALLBACK;
}

/** One emoji only — never stack. Strips an existing leading emoji before prefixing. */
export function editorialTitleWithIcon(
  icon: string | null | undefined,
  title: string
): string {
  const clean = title.trim().replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F?\u200D?]+\s*/u, "").trim();
  if (!clean) return clean;
  const glyph = icon?.trim();
  if (!glyph) return clean;
  return `${glyph} ${clean}`;
}
