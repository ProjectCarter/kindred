/**
 * Kindred Visual Language Constitution v1 — one category, one permanent emoji.
 * Canonical law: .cursor/rules/kindred-visual-language.mdc
 *
 * Icons help readers recognize categories before reading a word.
 * Same verified category → same icon everywhere. Never stack. Never rotate.
 */

import type { LocalEventCategory } from "./localEvents";
import type { DiscoveryCategory, DiscoveryItem } from "./discovery";
import type { EditorialCategoryId } from "./editorialCategory";
import type { BanditsPickKind } from "./bandit";

export type CategoryIconContext = "event" | "activity" | "recommendation" | "bandits_pick";

/** Official Kindred icon dictionary — one category, one emoji. */
export const CATEGORY_ICON_DICTIONARY = {
  live_music: "🎵",
  concert: "🎤",
  theater: "🎭",
  comedy: "😂",
  movies: "🎬",
  festival: "🎪",
  food_festival: "🍽️",
  coffee_shop: "☕",
  brewery: "🍺",
  winery: "🍷",
  cocktail_bar: "🍸",
  dancing: "💃",
  art_gallery: "🎨",
  museum: "🏛️",
  historic_site: "📜",
  library: "📚",
  bookstore: "📖",
  park: "🌳",
  botanical_garden: "🌸",
  nature_preserve: "🌿",
  scenic_view: "🌅",
  beach: "🏖️",
  lake_river: "🌊",
  hiking: "🥾",
  walking_trail: "🚶",
  cycling: "🚴",
  running: "🏃",
  pickleball: "🏓",
  tennis: "🎾",
  golf: "⛳",
  mini_golf: "🏌️",
  bowling: "🎳",
  arcade: "🕹️",
  escape_room: "🔐",
  go_karts: "🏎️",
  rock_climbing: "🧗",
  swimming: "🏊",
  playground: "🛝",
  dog_park: "🐕",
  pet_friendly: "🐾",
  shopping: "🛍️",
  antique_store: "🪑",
  flea_market: "🛒",
  community_event: "🤝",
  business_networking: "💼",
  educational_talk: "🎓",
  charity: "❤️",
  car_show: "🚗",
  aviation: "✈️",
  fireworks: "🎆",
  holiday_event: "🎄",
  farmers_market: "🥕",
  food_dining: "🍽️",
} as const;

/** Default when category cannot be verified — community gathering, not decorative. */
export const CATEGORY_ICON_FALLBACK = CATEGORY_ICON_DICTIONARY.community_event;

type HayInput = {
  title?: string | null;
  venue?: string | null;
  dek?: string | null;
  venueCategories?: string[] | null;
  tags?: string[] | null;
};

function hayFrom(input: HayInput): string {
  return [
    input.title,
    input.venue,
    input.dek,
    ...(input.venueCategories ?? []),
    ...(input.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function iconFromRules(
  hay: string,
  rules: Array<{ test: RegExp; icon: string }>,
  fallback: string
): string {
  for (const rule of rules) {
    if (rule.test.test(hay)) return rule.icon;
  }
  return fallback;
}

/**
 * Primary destinations — checked on verified venue first (brewery + live music → 🍺).
 */
const PRIMARY_VENUE_RULES: Array<{ test: RegExp; icon: string }> = [
  { test: /\b(escape\s*room)\b/, icon: CATEGORY_ICON_DICTIONARY.escape_room },
  { test: /\b(go-?kart|go kart)\b/, icon: CATEGORY_ICON_DICTIONARY.go_karts },
  { test: /\b(mini\s*golf|putt-?putt)\b/, icon: CATEGORY_ICON_DICTIONARY.mini_golf },
  { test: /\b(bowling)\b/, icon: CATEGORY_ICON_DICTIONARY.bowling },
  { test: /\b(arcade|video\s*arcade)\b/, icon: CATEGORY_ICON_DICTIONARY.arcade },
  {
    test: /\b(rock\s*climb|boulder(ing)?|climbing\s*gym)\b/,
    icon: CATEGORY_ICON_DICTIONARY.rock_climbing,
  },
  { test: /\b(brewery|brewpub|brewing|taproom)\b/, icon: CATEGORY_ICON_DICTIONARY.brewery },
  { test: /\b(winery|vineyard)\b/, icon: CATEGORY_ICON_DICTIONARY.winery },
  { test: /\b(cocktail|speakeasy|mixology)\b/, icon: CATEGORY_ICON_DICTIONARY.cocktail_bar },
  { test: /\b(coffee|cafe|café|espresso)\b/, icon: CATEGORY_ICON_DICTIONARY.coffee_shop },
  { test: /\b(museum)\b/, icon: CATEGORY_ICON_DICTIONARY.museum },
  {
    test: /\b(historic\s*(site|district|landmark|home|house)|heritage\s*(district|site))\b/,
    icon: CATEGORY_ICON_DICTIONARY.historic_site,
  },
  { test: /\b(library)\b/, icon: CATEGORY_ICON_DICTIONARY.library },
  { test: /\b(bookstore|book\s*shop)\b/, icon: CATEGORY_ICON_DICTIONARY.bookstore },
  { test: /\b(botanical|arboretum)\b/, icon: CATEGORY_ICON_DICTIONARY.botanical_garden },
  { test: /\b(beach)\b/, icon: CATEGORY_ICON_DICTIONARY.beach },
  { test: /\b(dog\s*park)\b/, icon: CATEGORY_ICON_DICTIONARY.dog_park },
  { test: /\b(playground)\b/, icon: CATEGORY_ICON_DICTIONARY.playground },
  { test: /\b(art\s*gallery|gallery)\b/, icon: CATEGORY_ICON_DICTIONARY.art_gallery },
  { test: /\b(golf\s*course|country\s*club)\b/, icon: CATEGORY_ICON_DICTIONARY.golf },
];

/**
 * Event and experience rules — full title + venue when venue is not a primary destination.
 */
const EVENT_AND_TITLE_RULES: Array<{ test: RegExp; icon: string }> = [
  ...PRIMARY_VENUE_RULES,
  { test: /\b(wine\s*tasting)\b/, icon: CATEGORY_ICON_DICTIONARY.winery },
  {
    test: /\b(nature\s*preserve|wildlife\s*refuge)\b/,
    icon: CATEGORY_ICON_DICTIONARY.nature_preserve,
  },
  { test: /\b(lake|river|waterfront|kayak|paddleboard|paddle\s*board|boating)\b/, icon: CATEGORY_ICON_DICTIONARY.lake_river },
  { test: /\b(antique\s*(shop|store|mall))\b/, icon: CATEGORY_ICON_DICTIONARY.antique_store },
  { test: /\b(flea\s*market)\b/, icon: CATEGORY_ICON_DICTIONARY.flea_market },
  { test: /\b(golf\b)(?!.*mini)/, icon: CATEGORY_ICON_DICTIONARY.golf },
  { test: /\bfarmers?\s*market\b/, icon: CATEGORY_ICON_DICTIONARY.farmers_market },
  {
    test: /\bfood\s*(truck\s*)?festival\b|\btaco\s*festival\b|\bfood\s*fest\b/,
    icon: CATEGORY_ICON_DICTIONARY.food_festival,
  },
  {
    test: /\b(festival|fair|parade|carnival|street\s*fair)\b/,
    icon: CATEGORY_ICON_DICTIONARY.festival,
  },
  {
    test: /\b(holiday|christmas\s*market|tree\s*lighting|santa\b|hanukkah|kwanzaa)\b/,
    icon: CATEGORY_ICON_DICTIONARY.holiday_event,
  },
  { test: /\b(fireworks|fourth of july)\b/, icon: CATEGORY_ICON_DICTIONARY.fireworks },
  { test: /\b(car show|auto show|cruise night|classic car)\b/, icon: CATEGORY_ICON_DICTIONARY.car_show },
  { test: /\b(air\s*show|aviation|fly-?in)\b/, icon: CATEGORY_ICON_DICTIONARY.aviation },
  {
    test: /\b(charity|fundraiser|benefit\s*(concert|dinner|gala))\b/,
    icon: CATEGORY_ICON_DICTIONARY.charity,
  },
  {
    test: /\b(networking|business\s*mixer|chamber\s*of\s*commerce)\b/,
    icon: CATEGORY_ICON_DICTIONARY.business_networking,
  },
  {
    test: /\b(lecture|seminar|educational|author\s*talk|book\s*talk|poetry\s*reading)\b/,
    icon: CATEGORY_ICON_DICTIONARY.educational_talk,
  },
  { test: /\b(comedy|stand-?up|improv)\b/, icon: CATEGORY_ICON_DICTIONARY.comedy },
  { test: /\b(ballet|ballroom|dance\s*class|dancing)\b/, icon: CATEGORY_ICON_DICTIONARY.dancing },
  {
    test: /\b(theater|theatre|\bplay\b|broadway|musical|opera|shakespeare)\b/,
    icon: CATEGORY_ICON_DICTIONARY.theater,
  },
  { test: /\b(film|movie|cinema)\b/, icon: CATEGORY_ICON_DICTIONARY.movies },
  {
    test: /\b(concert\b|orchestra|symphony|philharmonic)\b/,
    icon: CATEGORY_ICON_DICTIONARY.concert,
  },
  {
    test: /\b(live\s*music|\bdj\b|jazz|blues|open\s*mic|acoustic\s*set|karaoke)\b/,
    icon: CATEGORY_ICON_DICTIONARY.live_music,
  },
  { test: /\b(pickleball)\b/, icon: CATEGORY_ICON_DICTIONARY.pickleball },
  { test: /\btennis\b/, icon: CATEGORY_ICON_DICTIONARY.tennis },
  { test: /\b(marathon|5k|10k|running\b|fun\s*run)\b/, icon: CATEGORY_ICON_DICTIONARY.running },
  { test: /\b(cycl(e|ing)|bike\s*ride|gran\s*fondo)\b/, icon: CATEGORY_ICON_DICTIONARY.cycling },
  { test: /\b(walking\s*trail)\b/, icon: CATEGORY_ICON_DICTIONARY.walking_trail },
  { test: /\b(hike|hiking)\b/, icon: CATEGORY_ICON_DICTIONARY.hiking },
  { test: /\b(swim|pool|aquatics)\b/, icon: CATEGORY_ICON_DICTIONARY.swimming },
  {
    test: /\b(sunrise|sunset|scenic\s*(view|overlook|vista))\b/,
    icon: CATEGORY_ICON_DICTIONARY.scenic_view,
  },
  { test: /\b(park\b)(?!.*dog)/, icon: CATEGORY_ICON_DICTIONARY.park },
  { test: /\b(shopping|mall|boutique)\b/, icon: CATEGORY_ICON_DICTIONARY.shopping },
  { test: /\b(dog\s*friendly|pet\s*friendly)\b/, icon: CATEGORY_ICON_DICTIONARY.pet_friendly },
  {
    test: /\b(community|town\s*hall|neighborhood|block\s*party|volunteer)\b/,
    icon: CATEGORY_ICON_DICTIONARY.community_event,
  },
  {
    test: /\b(food\b|dinner|brunch|restaurant|tasting|culinary|chef)\b/,
    icon: CATEGORY_ICON_DICTIONARY.food_dining,
  },
];

const EVENT_CATEGORY_FALLBACK: Record<LocalEventCategory, string> = {
  music: CATEGORY_ICON_DICTIONARY.live_music,
  comedy: CATEGORY_ICON_DICTIONARY.comedy,
  arts: CATEGORY_ICON_DICTIONARY.theater,
  family: CATEGORY_ICON_DICTIONARY.playground,
  sports: CATEGORY_ICON_DICTIONARY.running,
  food: CATEGORY_ICON_DICTIONARY.food_dining,
  market: CATEGORY_ICON_DICTIONARY.farmers_market,
  nightlife: CATEGORY_ICON_DICTIONARY.live_music,
  community: CATEGORY_ICON_DICTIONARY.community_event,
};

const DISCOVERY_CATEGORY_FALLBACK: Partial<Record<DiscoveryCategory, string>> = {
  coffee: CATEGORY_ICON_DICTIONARY.coffee_shop,
  restaurants: CATEGORY_ICON_DICTIONARY.food_dining,
  bakeries: CATEGORY_ICON_DICTIONARY.food_dining,
  beaches: CATEGORY_ICON_DICTIONARY.beach,
  hiking: CATEGORY_ICON_DICTIONARY.hiking,
  parks: CATEGORY_ICON_DICTIONARY.park,
  scenic_drives: CATEGORY_ICON_DICTIONARY.scenic_view,
  museums: CATEGORY_ICON_DICTIONARY.museum,
  books: CATEGORY_ICON_DICTIONARY.bookstore,
  movies: CATEGORY_ICON_DICTIONARY.movies,
  podcasts: CATEGORY_ICON_DICTIONARY.library,
  recipes: CATEGORY_ICON_DICTIONARY.food_dining,
  experiences: CATEGORY_ICON_DICTIONARY.community_event,
  travel: CATEGORY_ICON_DICTIONARY.aviation,
  activities: CATEGORY_ICON_DICTIONARY.community_event,
  gardens: CATEGORY_ICON_DICTIONARY.botanical_garden,
};

const EDITORIAL_CATEGORY_ICON: Partial<Record<EditorialCategoryId, string>> = {
  restaurant: CATEGORY_ICON_DICTIONARY.food_dining,
  coffee_shop: CATEGORY_ICON_DICTIONARY.coffee_shop,
  bakery: CATEGORY_ICON_DICTIONARY.food_dining,
  winery: CATEGORY_ICON_DICTIONARY.winery,
  cocktail_bar: CATEGORY_ICON_DICTIONARY.cocktail_bar,
  brewery: CATEGORY_ICON_DICTIONARY.brewery,
  park: CATEGORY_ICON_DICTIONARY.park,
  dog_park: CATEGORY_ICON_DICTIONARY.dog_park,
  playground: CATEGORY_ICON_DICTIONARY.playground,
  museum: CATEGORY_ICON_DICTIONARY.museum,
  historic_site: CATEGORY_ICON_DICTIONARY.historic_site,
  botanical_garden: CATEGORY_ICON_DICTIONARY.botanical_garden,
  beach: CATEGORY_ICON_DICTIONARY.beach,
  lake: CATEGORY_ICON_DICTIONARY.lake_river,
  river: CATEGORY_ICON_DICTIONARY.lake_river,
  scenic_lookout: CATEGORY_ICON_DICTIONARY.scenic_view,
  observation_deck: CATEGORY_ICON_DICTIONARY.scenic_view,
  scenic_drive: CATEGORY_ICON_DICTIONARY.scenic_view,
  library: CATEGORY_ICON_DICTIONARY.library,
  bookstore: CATEGORY_ICON_DICTIONARY.bookstore,
  arcade: CATEGORY_ICON_DICTIONARY.arcade,
  bowling_alley: CATEGORY_ICON_DICTIONARY.bowling,
  mini_golf: CATEGORY_ICON_DICTIONARY.mini_golf,
  escape_room: CATEGORY_ICON_DICTIONARY.escape_room,
  rock_climbing_gym: CATEGORY_ICON_DICTIONARY.rock_climbing,
  golf_course: CATEGORY_ICON_DICTIONARY.golf,
  pickleball: CATEGORY_ICON_DICTIONARY.pickleball,
  zoo: CATEGORY_ICON_DICTIONARY.museum,
  aquarium: CATEGORY_ICON_DICTIONARY.museum,
  farm: CATEGORY_ICON_DICTIONARY.farmers_market,
  farmers_market: CATEGORY_ICON_DICTIONARY.farmers_market,
  shopping_district: CATEGORY_ICON_DICTIONARY.shopping,
  market: CATEGORY_ICON_DICTIONARY.shopping,
  kayaking: CATEGORY_ICON_DICTIONARY.lake_river,
  paddleboarding: CATEGORY_ICON_DICTIONARY.lake_river,
  theater: CATEGORY_ICON_DICTIONARY.theater,
  country_club: CATEGORY_ICON_DICTIONARY.golf,
  rock_shop: CATEGORY_ICON_DICTIONARY.shopping,
  general_place: CATEGORY_ICON_FALLBACK,
};

export function resolveEventCategoryIcon(input: {
  name: string;
  venue?: string | null;
  category?: LocalEventCategory | null;
  dek?: string | null;
}): string {
  const venueHay = hayFrom({ venue: input.venue });
  const venueIcon = iconFromRules(venueHay, PRIMARY_VENUE_RULES, "");
  if (venueIcon) return venueIcon;

  const hay = hayFrom({
    title: input.name,
    venue: input.venue,
    dek: input.dek,
  });
  const fromText = iconFromRules(hay, EVENT_AND_TITLE_RULES, "");
  if (fromText) return fromText;
  if (input.category) return EVENT_CATEGORY_FALLBACK[input.category];
  return CATEGORY_ICON_FALLBACK;
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
  const hay = hayFrom(item);

  if (item.editorialCategoryId && EDITORIAL_CATEGORY_ICON[item.editorialCategoryId]) {
    return EDITORIAL_CATEGORY_ICON[item.editorialCategoryId]!;
  }

  const fromText = iconFromRules(hay, EVENT_AND_TITLE_RULES, "");
  if (fromText) return fromText;

  if (item.activitySubtype === "hiking") return CATEGORY_ICON_DICTIONARY.hiking;
  if (item.activitySubtype === "water_recreation") return CATEGORY_ICON_DICTIONARY.lake_river;
  if (item.activitySubtype === "rock_climbing") return CATEGORY_ICON_DICTIONARY.rock_climbing;
  if (item.activitySubtype === "pickleball") return CATEGORY_ICON_DICTIONARY.pickleball;
  if (item.activitySubtype === "karaoke") return CATEGORY_ICON_DICTIONARY.live_music;
  if (item.activitySubtype === "arcades") return CATEGORY_ICON_DICTIONARY.arcade;
  if (item.activitySubtype === "bowling") return CATEGORY_ICON_DICTIONARY.bowling;
  if (item.activitySubtype === "mini_golf") return CATEGORY_ICON_DICTIONARY.mini_golf;
  if (item.activitySubtype === "escape_rooms") return CATEGORY_ICON_DICTIONARY.escape_room;
  if (item.activitySubtype === "go_karts") return CATEGORY_ICON_DICTIONARY.go_karts;
  if (item.activitySubtype) return CATEGORY_ICON_FALLBACK;

  const discoveryFallback = DISCOVERY_CATEGORY_FALLBACK[item.category];
  if (discoveryFallback) return discoveryFallback;

  if (context === "activity" || context === "recommendation") {
    return CATEGORY_ICON_FALLBACK;
  }
  return CATEGORY_ICON_FALLBACK;
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

  const hay = hayFrom({ title: input.headline, dek: input.summary });
  const fromText = iconFromRules(hay, EVENT_AND_TITLE_RULES, "");
  if (fromText) return fromText;

  const kindFallback: Partial<Record<BanditsPickKind, string>> = {
    activity: CATEGORY_ICON_FALLBACK,
    place: CATEGORY_ICON_DICTIONARY.food_dining,
    hidden_gem: CATEGORY_ICON_DICTIONARY.nature_preserve,
    seasonal: CATEGORY_ICON_DICTIONARY.festival,
    article: CATEGORY_ICON_DICTIONARY.library,
  };
  return kindFallback[input.kind] ?? CATEGORY_ICON_FALLBACK;
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
