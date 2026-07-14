/**
 * Venue classification from structured metadata — Foursquare categories,
 * provider labels, and tags take priority over title keyword guessing.
 *
 * Server mirror: supabase/functions/_shared/venueClassification.ts
 */

import type { ImageCategoryTag } from "./imageTaxonomy";

export type VenueClassificationInput = {
  title?: string | null;
  venueCategories?: string[] | null;
  providerCategory?: string | null;
  discoveryCategory?: string | null;
  dek?: string | null;
  address?: string | null;
  tags?: string[] | null;
};

export type VenueClassification = {
  /** Image taxonomy tag — drives search + library lookup. */
  editorialType: ImageCategoryTag;
  /** Human label for articles and cards — e.g. "dog park", "escape room". */
  displayLabel: string;
  confidence: "high" | "medium" | "low";
  /** Where the classification came from. */
  source: "foursquare" | "metadata" | "title" | "discovery_category";
};

type FsqRule = {
  pattern: RegExp;
  editorialType: ImageCategoryTag;
  displayLabel: string;
};

/**
 * Foursquare / provider category strings — highest trust.
 * Order matters: more specific patterns first.
 */
const FSQ_CATEGORY_RULES: FsqRule[] = [
  { pattern: /dog park/i, editorialType: "dog_park", displayLabel: "dog park" },
  { pattern: /escape room|escapology/i, editorialType: "escape_room", displayLabel: "escape room" },
  { pattern: /observatory|planetarium/i, editorialType: "specialty_museum", displayLabel: "observatory" },
  { pattern: /historical museum|history museum|heritage (?:center|museum|site|house)/i, editorialType: "history_museum", displayLabel: "history museum" },
  { pattern: /art museum|art gallery/i, editorialType: "art_gallery", displayLabel: "art gallery" },
  { pattern: /museum/i, editorialType: "museum", displayLabel: "museum" },
  { pattern: /country club|golf club|clubhouse/i, editorialType: "country_club", displayLabel: "country club" },
  { pattern: /golf course|driving range/i, editorialType: "golf_course", displayLabel: "golf course" },
  { pattern: /rock shop|gem shop|mineral|lapidary|crystal shop/i, editorialType: "rock_shop", displayLabel: "rock and gem shop" },
  { pattern: /japanese restaurant|sushi|ramen|izakaya/i, editorialType: "restaurant", displayLabel: "Japanese restaurant" },
  { pattern: /mexican restaurant|taqueria/i, editorialType: "restaurant", displayLabel: "Mexican restaurant" },
  { pattern: /italian restaurant|pizzeria|trattoria/i, editorialType: "restaurant", displayLabel: "Italian restaurant" },
  { pattern: /steakhouse|steak house/i, editorialType: "restaurant", displayLabel: "steakhouse" },
  { pattern: /coffee shop|café|cafe|espresso|coffee roaster/i, editorialType: "coffee_shop", displayLabel: "coffee shop" },
  { pattern: /bakery|patisserie|bake shop/i, editorialType: "bakery", displayLabel: "bakery" },
  { pattern: /bowling/i, editorialType: "bowling", displayLabel: "bowling alley" },
  { pattern: /mini golf|miniature golf/i, editorialType: "mini_golf", displayLabel: "mini golf course" },
  { pattern: /rock climbing|climbing gym|boulder gym/i, editorialType: "rock_climbing", displayLabel: "rock climbing gym" },
  { pattern: /axe throwing/i, editorialType: "axe_throwing", displayLabel: "axe throwing venue" },
  { pattern: /go-kart|go kart|karting/i, editorialType: "go_karts", displayLabel: "go-kart track" },
  { pattern: /kayak/i, editorialType: "kayaking", displayLabel: "kayaking" },
  { pattern: /paddleboard|paddle board|sup rental/i, editorialType: "paddleboarding", displayLabel: "paddleboarding" },
  { pattern: /arcade|game center/i, editorialType: "arcade", displayLabel: "arcade" },
  { pattern: /botanical garden|arboretum|conservatory/i, editorialType: "botanical_garden", displayLabel: "botanical garden" },
  { pattern: /playground/i, editorialType: "playground", displayLabel: "playground" },
  { pattern: /dog park|off.leash/i, editorialType: "dog_park", displayLabel: "dog park" },
  { pattern: /trail|trailhead|hiking/i, editorialType: "hiking", displayLabel: "hiking trail" },
  { pattern: /scenic lookout|viewpoint|overlook/i, editorialType: "scenic_drive", displayLabel: "scenic lookout" },
  { pattern: /\bbeach\b/i, editorialType: "beach", displayLabel: "beach" },
  { pattern: /\blake\b|lakeside|reservoir/i, editorialType: "lake", displayLabel: "lake" },
  { pattern: /\bpark\b|preserve|green space|nature preserve/i, editorialType: "park", displayLabel: "park" },
  { pattern: /restaurant|grill|bistro|eatery|diner|tavern/i, editorialType: "restaurant", displayLabel: "restaurant" },
  { pattern: /bookstore|book shop/i, editorialType: "library", displayLabel: "bookstore" },
  { pattern: /library/i, editorialType: "library", displayLabel: "library" },
  { pattern: /theater|theatre|performing arts/i, editorialType: "theater", displayLabel: "theater" },
  { pattern: /farmers?\s*market/i, editorialType: "farmers_market", displayLabel: "farmers market" },
  { pattern: /neighborhood|residential|subdivision/i, editorialType: "general_activity", displayLabel: "neighborhood" },
];

/** Title-only patterns when Foursquare labels are missing. */
const TITLE_RULES: FsqRule[] = [
  { pattern: /rock shop|gem shop|natural expressions/i, editorialType: "rock_shop", displayLabel: "rock and gem shop" },
  { pattern: /cosmo dog|dog park/i, editorialType: "dog_park", displayLabel: "dog park" },
  { pattern: /escapology|escape room/i, editorialType: "escape_room", displayLabel: "escape room" },
  { pattern: /historical museum|heritage museum/i, editorialType: "history_museum", displayLabel: "history museum" },
  { pattern: /observatory|planetarium/i, editorialType: "specialty_museum", displayLabel: "observatory" },
  { pattern: /sushiya|sushi bar|ramen/i, editorialType: "restaurant", displayLabel: "Japanese restaurant" },
  { pattern: /country club|clubhouse/i, editorialType: "country_club", displayLabel: "country club" },
];

const DISCOVERY_FALLBACK: Partial<Record<string, { editorialType: ImageCategoryTag; displayLabel: string }>> = {
  coffee: { editorialType: "coffee_shop", displayLabel: "coffee shop" },
  restaurants: { editorialType: "restaurant", displayLabel: "restaurant" },
  bakeries: { editorialType: "bakery", displayLabel: "bakery" },
  parks: { editorialType: "park", displayLabel: "park" },
  gardens: { editorialType: "botanical_garden", displayLabel: "botanical garden" },
  museums: { editorialType: "museum", displayLabel: "museum" },
  beaches: { editorialType: "beach", displayLabel: "beach" },
  hiking: { editorialType: "hiking", displayLabel: "hiking trail" },
  scenic_drives: { editorialType: "scenic_drive", displayLabel: "scenic lookout" },
  activities: { editorialType: "general_activity", displayLabel: "local activity" },
};

/** Hard contradictions — never apply a misleading type. */
const TYPE_CONTRADICTIONS: Partial<Record<ImageCategoryTag, RegExp>> = {
  beach: /country club|golf club|rock shop|gem shop|restaurant|neighborhood|coffee|café|cafe|dog park|observatory|planetarium|bowling|escape room/i,
  playground: /dog park|cosmo dog/i,
  scenic_drive: /observatory|planetarium|museum|restaurant|coffee|dog park|bowling|escape room/i,
  park: /restaurant|coffee shop|bowling|escape room/i,
};

const EDITORIAL_SUBSTITUTE: Partial<Record<ImageCategoryTag, string>> = {
  dog_park: "beautiful dog park dogs playing",
  escape_room: "escape room puzzle clues team",
  museum: "museum gallery exhibit interior",
  history_museum: "history museum exhibit gallery",
  art_gallery: "art gallery exhibition",
  specialty_museum: "observatory telescope night sky",
  country_club: "country club golf lake",
  restaurant: "local restaurant dining room",
  coffee_shop: "cozy coffee shop interior",
  bakery: "artisan bakery pastries",
  bowling: "bowling alley lanes",
  mini_golf: "mini golf course colorful",
  rock_climbing: "indoor rock climbing gym",
  axe_throwing: "axe throwing venue",
  go_karts: "go kart track racing",
  kayaking: "kayaking calm water",
  paddleboarding: "paddleboarding lake",
  botanical_garden: "botanical garden flowers path",
  park: "neighborhood park trees green",
  beach: "sandy beach shoreline",
  hiking: "hiking trail scenic",
  scenic_drive: "scenic desert vista overlook",
  lake: "calm lake shoreline",
  arcade: "arcade game room neon",
  general_activity: "local activity venue",
};

function categoryBlob(input: VenueClassificationInput): string {
  return [
    ...(input.venueCategories ?? []),
    input.providerCategory,
    input.title,
    input.dek,
  ]
    .filter(Boolean)
    .join(" ");
}

function matchRules(blob: string, rules: FsqRule[]): FsqRule | null {
  for (const rule of rules) {
    if (rule.pattern.test(blob)) return rule;
  }
  return null;
}

function isContradicted(type: ImageCategoryTag, blob: string): boolean {
  const pattern = TYPE_CONTRADICTIONS[type];
  return pattern ? pattern.test(blob) : false;
}

export function resolveVenueClassification(
  input: VenueClassificationInput
): VenueClassification {
  const blob = categoryBlob(input);
  const titleBlob = [input.title, input.dek].filter(Boolean).join(" ");

  const titleMatch = matchRules(titleBlob, TITLE_RULES);
  if (titleMatch && !isContradicted(titleMatch.editorialType, titleBlob)) {
    const strongTitle = /rock shop|gem shop|cosmo dog|escapology|country club|historical museum|sushiya|observatory|planetarium/i.test(
      titleBlob
    );
    if (strongTitle) {
      return {
        editorialType: titleMatch.editorialType,
        displayLabel: titleMatch.displayLabel,
        confidence: "high",
        source: "title",
      };
    }
  }

  const fsqMatch = matchRules(blob, FSQ_CATEGORY_RULES);
  if (fsqMatch && !isContradicted(fsqMatch.editorialType, blob)) {
    return {
      editorialType: fsqMatch.editorialType,
      displayLabel: fsqMatch.displayLabel,
      confidence: "high",
      source: "foursquare",
    };
  }

  if (titleMatch && !isContradicted(titleMatch.editorialType, titleBlob)) {
    return {
      editorialType: titleMatch.editorialType,
      displayLabel: titleMatch.displayLabel,
      confidence: "medium",
      source: "title",
    };
  }

  const fallback = input.discoveryCategory
    ? DISCOVERY_FALLBACK[input.discoveryCategory]
    : undefined;
  if (fallback && !isContradicted(fallback.editorialType, blob)) {
    return {
      editorialType: fallback.editorialType,
      displayLabel: fallback.displayLabel,
      confidence: "low",
      source: "discovery_category",
    };
  }

  return {
    editorialType: "general_activity",
    displayLabel: "local place",
    confidence: "low",
    source: "discovery_category",
  };
}

/** Normalized key for library venue reuse. */
export function venueLibraryTag(
  title: string,
  city?: string | null
): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-");
  const t = normalize(title);
  const c = city ? normalize(city) : "";
  return c ? `venue:${t}:${c}` : `venue:${t}`;
}

export function extractCityState(address?: string | null): {
  city: string | null;
  state: string | null;
} {
  if (!address?.trim()) return { city: null, state: null };
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const statePart = parts[parts.length - 1];
    const cityPart = parts[parts.length - 2];
    const stateMatch = statePart.match(/\b(AZ|Arizona|CA|California|TX|Texas|UT|Utah|CO|Colorado|NM|New Mexico)\b/i);
    return {
      city: cityPart || null,
      state: stateMatch ? stateMatch[0] : statePart || null,
    };
  }
  return { city: null, state: null };
}

/**
 * Image search priority (Phase 5):
 * 1. Exact venue + place
 * 2. Venue name + category
 * 3. Editorial substitute for venue type
 */
export function buildEditorialImageSearchQueries(input: {
  title: string;
  city?: string | null;
  state?: string | null;
  classification: VenueClassification;
}): string[] {
  const title = input.title.trim();
  const city = input.city?.trim() || "";
  const state = input.state?.trim() || "";
  const label = input.classification.displayLabel;
  const substitute =
    EDITORIAL_SUBSTITUTE[input.classification.editorialType] ??
    EDITORIAL_SUBSTITUTE.general_activity!;

  const queries: string[] = [];

  if (title && city) {
    queries.push([title, city, state].filter(Boolean).join(" "));
  } else if (title && state) {
    queries.push(`${title} ${state}`);
  }

  if (title && label) {
    queries.push(`${title} ${label}`);
  }

  queries.push(substitute);

  return [...new Set(queries.filter((q) => q.trim().length >= 3))];
}

/** Editorial display label for articles — prefers Foursquare over bucket. */
export function venueDisplayLabel(input: VenueClassificationInput): string {
  return resolveVenueClassification(input).displayLabel;
}
