/**
 * Extensible Kindred image taxonomy — shared category tags for classification,
 * library lookup, and stock-image search queries. Add new tags here rather
 * than hard-coding throughout the app.
 */

import {
  resolveVenueClassification,
  buildEditorialImageSearchQueries,
  extractCityState,
} from "./venueClassification";

export type ImageCategoryTag =
  | "coffee_shop"
  | "restaurant"
  | "bakery"
  | "park"
  | "botanical_garden"
  | "museum"
  | "history_museum"
  | "art_gallery"
  | "rock_shop"
  | "specialty_museum"
  | "golf_course"
  | "country_club"
  | "lake"
  | "beach"
  | "hiking"
  | "scenic_drive"
  | "farmers_market"
  | "concert"
  | "theater"
  | "festival"
  | "family_event"
  | "library"
  | "storytime"
  | "painting_class"
  | "cooking_class"
  | "bowling"
  | "escape_room"
  | "kayaking"
  | "paddleboarding"
  | "cycling"
  | "dog_park"
  | "playground"
  | "arcade"
  | "mini_golf"
  | "rock_climbing"
  | "axe_throwing"
  | "go_karts"
  | "networking_event"
  | "general_activity";

export type ImageOrientation = "portrait" | "landscape" | "square";

export type ClassificationInput = {
  title?: string | null;
  venue?: string | null;
  dek?: string | null;
  providerCategory?: string | null;
  venueCategories?: string[] | null;
  discoveryCategory?: string | null;
  eventType?: string | null;
  address?: string | null;
  city?: string | null;
  environment?: string | null;
};

export type ClassificationResult = {
  primary: ImageCategoryTag;
  secondary: ImageCategoryTag[];
  confidence: "high" | "medium" | "low";
  searchQuery: string;
  /** Priority-ordered queries: venue+place, venue+category, editorial substitute. */
  searchQueries: string[];
  environmentTags: string[];
  displayLabel: string;
};

type Rule = {
  tag: ImageCategoryTag;
  pattern: RegExp;
  weight: number;
};

const RULES: Rule[] = [
  { tag: "country_club", pattern: /country club|golf club|lakes club/i, weight: 10 },
  { tag: "golf_course", pattern: /golf course|golf club|fairway|tee box/i, weight: 9 },
  { tag: "rock_shop", pattern: /rock shop|gem shop|mineral|crystals?\b|lapidary/i, weight: 10 },
  { tag: "coffee_shop", pattern: /coffee|café|cafe|espresso|roaster|roastery/i, weight: 9 },
  { tag: "storytime", pattern: /story\s*time|storytime|children'?s reading/i, weight: 10 },
  { tag: "library", pattern: /\blibrary\b|bookstore|books?\b/i, weight: 8 },
  { tag: "painting_class", pattern: /paint\s*(?:night|class)|flutter and glow|canvas class|sip and paint/i, weight: 10 },
  { tag: "cooking_class", pattern: /cooking class|culinary class|chef class|bake class/i, weight: 10 },
  { tag: "escape_room", pattern: /escape room|escapology|puzzle room/i, weight: 10 },
  { tag: "bowling", pattern: /bowling|bowlero|lanes\b/i, weight: 10 },
  { tag: "kayaking", pattern: /kayak/i, weight: 10 },
  { tag: "paddleboarding", pattern: /paddleboard|sup\b/i, weight: 10 },
  { tag: "farmers_market", pattern: /farmers?\s*market|vendor market/i, weight: 10 },
  { tag: "theater", pattern: /theatre|theater|playhouse|performing arts/i, weight: 9 },
  { tag: "concert", pattern: /concert|live music|symphony|orchestra/i, weight: 9 },
  { tag: "festival", pattern: /festival|fair\b|carnival/i, weight: 8 },
  { tag: "family_event", pattern: /family|kids|children|toddler/i, weight: 7 },
  { tag: "networking_event", pattern: /networking|business mixer|chamber of commerce/i, weight: 9 },
  { tag: "botanical_garden", pattern: /botanical|arboretum|conservatory/i, weight: 9 },
  { tag: "dog_park", pattern: /dog park|cosmo dog/i, weight: 9 },
  { tag: "playground", pattern: /playground|play structure/i, weight: 8 },
  { tag: "hiking", pattern: /hike|hiking|trailhead|summit trail/i, weight: 9 },
  { tag: "scenic_drive", pattern: /scenic drive|lookout|viewpoint|overlook|sunset spot/i, weight: 8 },
  { tag: "lake", pattern: /\blake\b|lakeside|reservoir/i, weight: 8 },
  { tag: "beach", pattern: /\bbeach\b|shoreline|coast/i, weight: 8 },
  { tag: "museum", pattern: /museum|gallery|exhibit/i, weight: 7 },
  { tag: "history_museum", pattern: /historical museum|history museum|heritage center/i, weight: 9 },
  { tag: "art_gallery", pattern: /art gallery|art museum/i, weight: 9 },
  { tag: "bakery", pattern: /bakery|bake shop|patisserie|pastry/i, weight: 9 },
  { tag: "restaurant", pattern: /restaurant|grill|bistro|eatery|diner|tavern|kitchen/i, weight: 7 },
  { tag: "park", pattern: /\bpark\b|preserve|green space/i, weight: 7 },
  { tag: "mini_golf", pattern: /mini golf|miniature golf/i, weight: 10 },
  { tag: "rock_climbing", pattern: /rock climbing|climbing gym|boulder/i, weight: 10 },
  { tag: "axe_throwing", pattern: /axe throwing|ax throwing/i, weight: 10 },
  { tag: "go_karts", pattern: /go-kart|go kart|karting/i, weight: 10 },
  { tag: "arcade", pattern: /arcade|game center/i, weight: 9 },
  { tag: "cycling", pattern: /cycling|bike ride|bicycle/i, weight: 8 },
];

const DISCOVERY_CATEGORY_HINTS: Partial<Record<string, ImageCategoryTag>> = {
  coffee: "coffee_shop",
  restaurants: "restaurant",
  bakeries: "bakery",
  parks: "park",
  gardens: "botanical_garden",
  museums: "museum",
  beaches: "beach",
  hiking: "hiking",
  scenic_drives: "scenic_drive",
  activities: "general_activity",
};

const SEARCH_QUERY_BY_TAG: Record<ImageCategoryTag, string> = {
  coffee_shop: "cozy coffee shop interior",
  restaurant: "local restaurant dining room",
  bakery: "artisan bakery pastries",
  park: "neighborhood park trees",
  botanical_garden: "botanical garden flowers",
  museum: "museum exhibit gallery",
  history_museum: "history museum interior",
  art_gallery: "art gallery exhibition",
  rock_shop: "rock and mineral shop crystals",
  specialty_museum: "small specialty museum",
  golf_course: "desert golf course Arizona",
  country_club: "country club lake golf",
  lake: "calm lake shoreline",
  beach: "sandy beach shoreline",
  hiking: "Arizona hiking trail desert",
  scenic_drive: "scenic desert road vista",
  farmers_market: "farmers market outdoor stalls",
  concert: "live concert small venue",
  theater: "theater stage performance",
  festival: "outdoor community festival",
  family_event: "family outdoor event",
  library: "public library reading room",
  storytime: "children library storytime",
  painting_class: "paint class studio",
  cooking_class: "cooking class kitchen",
  bowling: "bowling alley lanes",
  escape_room: "escape room puzzle clues",
  kayaking: "kayaking calm water",
  paddleboarding: "paddleboarding lake",
  cycling: "cycling trail",
  dog_park: "dog park open field",
  playground: "playground children park",
  arcade: "arcade game room",
  mini_golf: "mini golf course",
  rock_climbing: "indoor rock climbing gym",
  axe_throwing: "axe throwing venue",
  go_karts: "go kart track",
  networking_event: "business networking event",
  general_activity: "local activity venue",
};

function haystack(input: ClassificationInput): string {
  return [
    input.title,
    input.venue,
    input.dek,
    input.providerCategory,
    input.address,
    input.environment,
    ...(input.venueCategories ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

export function classifyImageSubject(
  input: ClassificationInput
): ClassificationResult {
  const blob = haystack(input);

  const venueClass = resolveVenueClassification({
    title: input.title,
    venueCategories: input.venueCategories,
    providerCategory: input.providerCategory,
    discoveryCategory: input.discoveryCategory,
    dek: input.dek,
    address: input.address,
  });

  const scores = new Map<ImageCategoryTag, number>();

  for (const rule of RULES) {
    if (rule.pattern.test(blob)) {
      scores.set(rule.tag, (scores.get(rule.tag) ?? 0) + rule.weight);
    }
  }

  const discoveryHint = input.discoveryCategory
    ? DISCOVERY_CATEGORY_HINTS[input.discoveryCategory]
    : undefined;
  if (discoveryHint) {
    scores.set(discoveryHint, (scores.get(discoveryHint) ?? 0) + 3);
  }

  if (/country club|golf club|rock shop|gem shop|neighborhood|observatory|planetarium|dog park|cosmo dog/i.test(blob)) {
    scores.delete("beach");
  }
  if (/dog park|cosmo dog/i.test(blob)) {
    scores.delete("playground");
  }
  if (/observatory|planetarium/i.test(blob)) {
    scores.delete("scenic_drive");
  }

  scores.set(
    venueClass.editorialType,
    (scores.get(venueClass.editorialType) ?? 0) +
      (venueClass.confidence === "high" ? 14 : venueClass.confidence === "medium" ? 10 : 4)
  );

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primary =
    venueClass.confidence !== "low"
      ? venueClass.editorialType
      : ranked[0]?.[0] ?? discoveryHint ?? "general_activity";
  const topScore = ranked[0]?.[1] ?? 0;
  const secondScore = ranked[1]?.[1] ?? 0;

  let confidence: ClassificationResult["confidence"] = venueClass.confidence;
  if (venueClass.confidence === "low") {
    if (topScore >= 9) confidence = "high";
    else if (topScore >= 6 && topScore > secondScore + 2) confidence = "medium";
    else confidence = "low";
  }

  const secondary = ranked
    .slice(1, 4)
    .map(([tag]) => tag)
    .filter((tag) => tag !== primary);

  const envTags: string[] = [];
  if (input.environment?.trim()) envTags.push(input.environment.trim());
  if (input.address && /az|arizona/i.test(input.address)) envTags.push("arizona");
  if (/desert/i.test(blob)) envTags.push("desert");

  const { city: parsedCity, state } = extractCityState(input.address);
  const city = input.city?.trim() || parsedCity;
  const searchQueries = buildEditorialImageSearchQueries({
    title: input.title?.trim() ?? "",
    city,
    state,
    classification: {
      ...venueClass,
      editorialType: primary,
    },
  });

  let searchQuery = searchQueries[searchQueries.length - 1] ?? SEARCH_QUERY_BY_TAG[primary];
  if (envTags.includes("arizona") && primary === "hiking") {
    searchQuery = "Arizona desert hiking trail";
    searchQueries[searchQueries.length - 1] = searchQuery;
  }
  if (envTags.includes("arizona") && primary === "golf_course") {
    searchQuery = "Arizona desert golf course";
    searchQueries[searchQueries.length - 1] = searchQuery;
  }

  return {
    primary,
    secondary,
    confidence,
    searchQuery,
    searchQueries,
    environmentTags: envTags,
    displayLabel: venueClass.displayLabel,
  };
}

export function searchQueryForTag(
  tag: ImageCategoryTag,
  environmentTags: string[] = []
): string {
  const base = SEARCH_QUERY_BY_TAG[tag] ?? SEARCH_QUERY_BY_TAG.general_activity;
  if (environmentTags.includes("arizona")) {
    return `${base} Arizona`;
  }
  return base;
}
