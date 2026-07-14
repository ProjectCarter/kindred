/**
 * Verified editorial categories — classified before images or copy.
 * Resolution order: Foursquare category → business name → description →
 * internal Kindred category. Never from a single keyword alone.
 *
 * Server mirror: supabase/functions/_shared/editorialCategory.ts
 */

import type { ImageCategoryTag } from "./imageTaxonomy";

export type EditorialCategoryId =
  | "restaurant"
  | "coffee_shop"
  | "bakery"
  | "winery"
  | "cocktail_bar"
  | "brewery"
  | "park"
  | "dog_park"
  | "playground"
  | "museum"
  | "historic_site"
  | "botanical_garden"
  | "beach"
  | "lake"
  | "river"
  | "scenic_lookout"
  | "observation_deck"
  | "scenic_drive"
  | "library"
  | "bookstore"
  | "arcade"
  | "bowling_alley"
  | "mini_golf"
  | "escape_room"
  | "rock_climbing_gym"
  | "golf_course"
  | "pickleball"
  | "zoo"
  | "aquarium"
  | "farm"
  | "farmers_market"
  | "shopping_district"
  | "market"
  | "kayaking"
  | "paddleboarding"
  | "theater"
  | "country_club"
  | "rock_shop"
  | "general_place";

export type EditorialCategoryInput = {
  title?: string | null;
  venueCategories?: string[] | null;
  providerCategory?: string | null;
  discoveryCategory?: string | null;
  dek?: string | null;
  address?: string | null;
};

export type VerifiedEditorialCategory = {
  categoryId: EditorialCategoryId;
  displayLabel: string;
  imageTag: ImageCategoryTag;
  confidence: "verified" | "likely" | "tentative";
  sources: Array<"foursquare" | "name" | "description">;
};

type CategoryProfile = {
  id: EditorialCategoryId;
  displayLabel: string;
  imageTag: ImageCategoryTag;
  fsq: RegExp[];
  name: RegExp[];
  description: RegExp[];
  strongName?: RegExp;
  imagePhrases: string[];
  forbiddenCopy: RegExp[];
};

const PROFILES: CategoryProfile[] = [
  {
    id: "dog_park",
    displayLabel: "dog park",
    imageTag: "dog_park",
    fsq: [/dog park|off.?leash/i],
    name: [/cosmo dog|dog park/i],
    description: [/dog park|off.?leash|dogs playing/i],
    strongName: /cosmo dog|dog park/i,
    imagePhrases: ["dog park dogs playing", "fenced dog park", "dogs running park"],
    forbiddenCopy: [/playground|swing|slide|children'?s play|kayak|paddleboard|beach|ocean|sand\b/i],
  },
  {
    id: "observation_deck",
    displayLabel: "observatory",
    imageTag: "specialty_museum",
    fsq: [/observatory|planetarium|astronomy/i],
    name: [/observatory|planetarium|stargazing/i],
    description: [/telescope|astronomy|stargazing|night sky/i],
    strongName: /observatory|planetarium/i,
    imagePhrases: ["observatory telescope", "astronomy stargazing", "night sky telescope"],
    forbiddenCopy: [/scenic drive|highway|road trip|desert road|beach|ocean|kayak|bowling/i],
  },
  {
    id: "winery",
    displayLabel: "winery",
    imageTag: "winery",
    fsq: [/winery|vineyard|wine bar|tasting room/i],
    name: [/wine box|winery|vineyard|cellar/i],
    description: [/wine tasting|vineyard|winery|sommelier/i],
    strongName: /wine box|winery|vineyard/i,
    imagePhrases: ["winery wine tasting", "wine bar patio", "vineyard rows"],
    forbiddenCopy: [/beach|ocean|sand\b|surf\b|kayak|paddleboard|playground|bowling/i],
  },
  {
    id: "brewery",
    displayLabel: "brewery",
    imageTag: "brewery",
    fsq: [/brewery|brewpub|microbrew/i],
    name: [/brewery|brewpub|taproom/i],
    description: [/craft beer|brewery|taproom|IPA|lager/i],
    imagePhrases: ["craft brewery taproom", "beer flight tasting"],
    forbiddenCopy: [/beach|ocean|kayak|playground|museum exhibit/i],
  },
  {
    id: "cocktail_bar",
    displayLabel: "cocktail bar",
    imageTag: "cocktail_bar",
    fsq: [/cocktail bar|speakeasy|lounge bar/i],
    name: [/cocktail|speakeasy|mixology/i],
    description: [/cocktail|mixology|craft drinks/i],
    imagePhrases: ["cocktail bar interior", "craft cocktails bar"],
    forbiddenCopy: [/beach|kayak|playground|dog park|museum/i],
  },
  {
    id: "escape_room",
    displayLabel: "escape room",
    imageTag: "escape_room",
    fsq: [/escape room/i],
    name: [/escapology|escape room/i],
    description: [/escape room|puzzle room|locked room/i],
    strongName: /escapology|escape room/i,
    imagePhrases: ["escape room puzzle clues", "escape room team"],
    forbiddenCopy: [/beach|kayak|paddleboard|golf course|dog park/i],
  },
  {
    id: "bowling_alley",
    displayLabel: "bowling alley",
    imageTag: "bowling",
    fsq: [/bowling/i],
    name: [/bowlero|bowling|lanes/i],
    description: [/bowling|bowlero|lane/i],
    strongName: /bowlero|bowling alley/i,
    imagePhrases: ["bowling alley lanes", "bowling strike neon"],
    forbiddenCopy: [/kayak|paddleboard|beach|ocean|golf fairway|dog park|playground swing/i],
  },
  {
    id: "rock_climbing_gym",
    displayLabel: "rock climbing gym",
    imageTag: "rock_climbing",
    fsq: [/climbing gym|boulder gym|rock climbing/i],
    name: [/climbing gym|boulder/i],
    description: [/rock climbing|bouldering|climbing wall/i],
    imagePhrases: ["indoor rock climbing gym", "bouldering wall"],
    forbiddenCopy: [/beach|kayak|bowling|winery|playground/i],
  },
  {
    id: "mini_golf",
    displayLabel: "mini golf course",
    imageTag: "mini_golf",
    fsq: [/mini golf|miniature golf/i],
    name: [/mini golf|putt.?putt/i],
    description: [/mini golf|miniature golf/i],
    imagePhrases: ["mini golf course colorful", "putt putt golf"],
    forbiddenCopy: [/kayak|beach|museum|bowling lanes/i],
  },
  {
    id: "pickleball",
    displayLabel: "pickleball court",
    imageTag: "pickleball",
    fsq: [/pickleball/i],
    name: [/pickleball/i],
    description: [/pickleball/i],
    imagePhrases: ["pickleball court outdoor", "pickleball game"],
    forbiddenCopy: [/kayak|beach|bowling|museum/i],
  },
  {
    id: "historic_site",
    displayLabel: "history museum",
    imageTag: "history_museum",
    fsq: [/historic site|heritage site|heritage house|historical museum|history museum/i],
    name: [/historical museum|heritage museum|historic/i],
    description: [/historic|heritage|history museum/i],
    strongName: /historical museum|heritage museum/i,
    imagePhrases: ["history museum exhibit", "historic site building"],
    forbiddenCopy: [/kayak|beach|bowling|playground|winery tasting/i],
  },
  {
    id: "museum",
    displayLabel: "museum",
    imageTag: "museum",
    fsq: [/^museum$|art museum|science museum|children'?s museum/i],
    name: [/museum/i],
    description: [/museum|exhibit|gallery/i],
    imagePhrases: ["museum gallery exhibit", "museum interior"],
    forbiddenCopy: [/kayak|paddleboard|beach|bowling alley|dog park|winery|scenic drive/i],
  },
  {
    id: "botanical_garden",
    displayLabel: "botanical garden",
    imageTag: "botanical_garden",
    fsq: [/botanical|arboretum|conservatory/i],
    name: [/botanical|arboretum/i],
    description: [/botanical|garden flowers|conservatory/i],
    imagePhrases: ["botanical garden flowers", "garden path greenhouse"],
    forbiddenCopy: [/bowling|kayak|beach|arcade/i],
  },
  {
    id: "coffee_shop",
    displayLabel: "coffee shop",
    imageTag: "coffee_shop",
    fsq: [/coffee shop|café|cafe|espresso|coffee roaster/i],
    name: [/coffee|rush|roaster|cafe/i],
    description: [/coffee|espresso|latte|cafe/i],
    imagePhrases: ["cozy coffee shop interior", "latte art cafe"],
    forbiddenCopy: [/beach|bowling|kayak|golf course|playground/i],
  },
  {
    id: "bakery",
    displayLabel: "bakery",
    imageTag: "bakery",
    fsq: [/bakery|patisserie|bake shop/i],
    name: [/bakery|bakeshop|patisserie/i],
    description: [/bakery|pastry|bread|croissant/i],
    imagePhrases: ["artisan bakery pastries", "fresh baked bread"],
    forbiddenCopy: [/beach|kayak|bowling|museum/i],
  },
  {
    id: "restaurant",
    displayLabel: "restaurant",
    imageTag: "restaurant",
    fsq: [/restaurant|grill|bistro|eatery|diner|tavern|steakhouse|sushi|ramen|pizzeria/i],
    name: [/restaurant|grill|bistro|sushiya|steakhouse|kitchen/i],
    description: [/restaurant|dining|menu|chef/i],
    imagePhrases: ["local restaurant dining room", "restaurant interior"],
    forbiddenCopy: [/beach|ocean|kayak|paddleboard|playground|dog park|bowling lane/i],
  },
  {
    id: "scenic_lookout",
    displayLabel: "scenic lookout",
    imageTag: "scenic_drive",
    fsq: [/scenic lookout|viewpoint|overlook|vista/i],
    name: [/lookout|viewpoint|overlook|vista/i],
    description: [/scenic view|overlook|vista|panorama/i],
    imagePhrases: ["scenic overlook vista", "mountain viewpoint panorama"],
    forbiddenCopy: [/restaurant dining|bowling|museum interior|coffee shop/i],
  },
  {
    id: "beach",
    displayLabel: "beach",
    imageTag: "beach",
    fsq: [/\bbeach\b|shore/i],
    name: [/\bbeach\b|shoreline/i],
    description: [/beach|shore|sand|waves/i],
    imagePhrases: ["sandy beach shoreline", "beach waves shore"],
    forbiddenCopy: [/bowling|restaurant dining|coffee shop|dog park fenced|museum/i],
  },
  {
    id: "lake",
    displayLabel: "lake",
    imageTag: "lake",
    fsq: [/\blake\b|lakeside|reservoir/i],
    name: [/\blake\b|lakeside/i],
    description: [/lake|lakeside|reservoir|dock/i],
    imagePhrases: ["calm lake shoreline", "lake dock sunset"],
    forbiddenCopy: [/bowling|restaurant interior|museum/i],
  },
  {
    id: "river",
    displayLabel: "river",
    imageTag: "river",
    fsq: [/\briver\b|riverwalk|waterfront trail/i],
    name: [/\briver\b|riverwalk/i],
    description: [/river|riverwalk|waterfront/i],
    imagePhrases: ["river walk trail", "calm river waterfront"],
    forbiddenCopy: [/bowling|museum|coffee shop/i],
  },
  {
    id: "park",
    displayLabel: "park",
    imageTag: "park",
    fsq: [/\bpark\b|preserve|green space|nature preserve/i],
    name: [/\bpark\b|preserve/i],
    description: [/park|trail|green space|nature/i],
    imagePhrases: ["neighborhood park trees", "park trail green space"],
    forbiddenCopy: [/restaurant dining|bowling|escape room|coffee shop interior/i],
  },
  {
    id: "playground",
    displayLabel: "playground",
    imageTag: "playground",
    fsq: [/playground|play structure/i],
    name: [/playground/i],
    description: [/playground|play structure|swings|slides/i],
    imagePhrases: ["playground children park", "play structure swings"],
    forbiddenCopy: [/dog park|off.?leash|winery|bar\b|kayak|museum/i],
  },
  {
    id: "library",
    displayLabel: "library",
    imageTag: "library",
    fsq: [/\blibrary\b/i],
    name: [/\blibrary\b/i],
    description: [/library|reading room|bookshelves/i],
    imagePhrases: ["public library reading room", "library bookshelves"],
    forbiddenCopy: [/beach|kayak|bowling|winery/i],
  },
  {
    id: "bookstore",
    displayLabel: "bookstore",
    imageTag: "bookstore",
    fsq: [/bookstore|book shop/i],
    name: [/bookstore|book shop|books\b/i],
    description: [/bookstore|books|reading/i],
    imagePhrases: ["independent bookstore shelves", "bookshop interior"],
    forbiddenCopy: [/beach|kayak|bowling|dog park/i],
  },
  {
    id: "arcade",
    displayLabel: "arcade",
    imageTag: "arcade",
    fsq: [/arcade|game center/i],
    name: [/arcade/i],
    description: [/arcade|video games|pinball/i],
    imagePhrases: ["arcade game room neon", "retro arcade games"],
    forbiddenCopy: [/beach|kayak|museum|botanical garden/i],
  },
  {
    id: "golf_course",
    displayLabel: "golf course",
    imageTag: "golf_course",
    fsq: [/golf course|driving range|fairway/i],
    name: [/golf course|driving range/i],
    description: [/golf|fairway|tee box/i],
    imagePhrases: ["golf course fairway", "golf green landscape"],
    forbiddenCopy: [/beach ocean|kayak|bowling|museum|dog park/i],
  },
  {
    id: "country_club",
    displayLabel: "country club",
    imageTag: "country_club",
    fsq: [/country club|golf club|clubhouse/i],
    name: [/country club|clubhouse|lakes club/i],
    description: [/country club|golf club|clubhouse/i],
    strongName: /country club|clubhouse/i,
    imagePhrases: ["country club golf lake", "clubhouse golf course"],
    forbiddenCopy: [/beach|ocean|sand\b|surf\b|public beach|kayak rental/i],
  },
  {
    id: "zoo",
    displayLabel: "zoo",
    imageTag: "zoo",
    fsq: [/\bzoo\b|wildlife park|safari park/i],
    name: [/\bzoo\b|wildlife/i],
    description: [/zoo|animals|wildlife/i],
    imagePhrases: ["zoo animals habitat", "zoo family visit"],
    forbiddenCopy: [/beach|bowling|coffee shop|winery/i],
  },
  {
    id: "aquarium",
    displayLabel: "aquarium",
    imageTag: "aquarium",
    fsq: [/aquarium|sea life|marine center/i],
    name: [/aquarium|sea life/i],
    description: [/aquarium|marine|fish tank/i],
    imagePhrases: ["aquarium tunnel fish", "aquarium exhibit"],
    forbiddenCopy: [/bowling|golf course|coffee shop|playground/i],
  },
  {
    id: "farm",
    displayLabel: "farm",
    imageTag: "farm",
    fsq: [/\bfarm\b|u-pick|orchard|petting zoo/i],
    name: [/\bfarm\b|orchard|u-pick/i],
    description: [/farm|orchard|u-pick|petting/i],
    imagePhrases: ["family farm orchard", "farm field barn"],
    forbiddenCopy: [/bowling|arcade|museum gallery|beach/i],
  },
  {
    id: "farmers_market",
    displayLabel: "farmers market",
    imageTag: "farmers_market",
    fsq: [/farmers?\s*market/i],
    name: [/farmers?\s*market/i],
    description: [/farmers market|vendor stalls|produce/i],
    imagePhrases: ["farmers market outdoor stalls", "farmers market produce"],
    forbiddenCopy: [/bowling|museum|kayak/i],
  },
  {
    id: "market",
    displayLabel: "market",
    imageTag: "market",
    fsq: [/public market|food hall|market hall/i],
    name: [/public market|food hall|market hall/i],
    description: [/market hall|food hall|vendors/i],
    imagePhrases: ["public market vendors", "food hall market"],
    forbiddenCopy: [/beach|kayak|bowling|golf/i],
  },
  {
    id: "shopping_district",
    displayLabel: "shopping district",
    imageTag: "shopping_district",
    fsq: [/shopping|shopping mall|retail district|outlet/i],
    name: [/shopping|outlet|mall/i],
    description: [/shopping|retail|stores/i],
    imagePhrases: ["shopping street storefronts", "retail district walkable"],
    forbiddenCopy: [/beach|kayak|hiking trail|museum exhibit/i],
  },
  {
    id: "kayaking",
    displayLabel: "kayaking",
    imageTag: "kayaking",
    fsq: [/kayak|canoe rental/i],
    name: [/kayak|canoe/i],
    description: [/kayak|canoe|paddle sport/i],
    imagePhrases: ["kayaking calm water", "kayak lake paddling"],
    forbiddenCopy: [/bowling|museum|coffee shop|playground|winery/i],
  },
  {
    id: "paddleboarding",
    displayLabel: "paddleboarding",
    imageTag: "paddleboarding",
    fsq: [/paddleboard|sup rental|stand up paddle/i],
    name: [/paddleboard|sup\b/i],
    description: [/paddleboard|stand up paddle/i],
    imagePhrases: ["paddleboarding lake", "stand up paddleboard"],
    forbiddenCopy: [/bowling|museum|playground|winery/i],
  },
  {
    id: "theater",
    displayLabel: "theater",
    imageTag: "theater",
    fsq: [/theater|theatre|performing arts|playhouse/i],
    name: [/theater|theatre|playhouse/i],
    description: [/theater|performance|stage/i],
    imagePhrases: ["theater stage performance", "theater auditorium"],
    forbiddenCopy: [/beach|kayak|dog park|bowling/i],
  },
  {
    id: "rock_shop",
    displayLabel: "rock and gem shop",
    imageTag: "rock_shop",
    fsq: [/rock shop|gem shop|mineral|lapidary/i],
    name: [/rock shop|gem shop|natural expressions/i],
    description: [/rock shop|gem|mineral|crystal/i],
    strongName: /rock shop|gem shop/i,
    imagePhrases: ["rock mineral shop crystals", "gem shop display"],
    forbiddenCopy: [/beach resort|art museum gallery|botanical garden/i],
  },
  {
    id: "scenic_drive",
    displayLabel: "scenic drive",
    imageTag: "scenic_drive",
    fsq: [/scenic byway|scenic drive|scenic route/i],
    name: [/scenic drive|scenic route|byway/i],
    description: [/scenic drive|byway|road trip route/i],
    imagePhrases: ["scenic desert road vista", "scenic highway overlook"],
    forbiddenCopy: [/restaurant dining|bowling|museum interior|observatory telescope/i],
  },
];

const PROFILE_BY_ID = new Map(PROFILES.map((p) => [p.id, p]));

const DISCOVERY_FALLBACK: Partial<
  Record<string, { id: EditorialCategoryId; label: string }>
> = {
  coffee: { id: "coffee_shop", label: "coffee shop" },
  restaurants: { id: "restaurant", label: "restaurant" },
  bakeries: { id: "bakery", label: "bakery" },
  parks: { id: "park", label: "park" },
  gardens: { id: "botanical_garden", label: "botanical garden" },
  museums: { id: "museum", label: "museum" },
  beaches: { id: "beach", label: "beach" },
  hiking: { id: "park", label: "trail" },
  scenic_drives: { id: "scenic_lookout", label: "scenic lookout" },
  activities: { id: "general_place", label: "local activity" },
};

type Scored = {
  profile: CategoryProfile;
  score: number;
  fsq: boolean;
  name: boolean;
  description: boolean;
};

function scoreProfile(profile: CategoryProfile, input: EditorialCategoryInput): Scored {
  const fsqBlob = [...(input.venueCategories ?? []), input.providerCategory]
    .filter(Boolean)
    .join(" ");
  const nameBlob = input.title?.trim() ?? "";
  const descBlob = input.dek?.trim() ?? "";

  const fsq = profile.fsq.some((p) => p.test(fsqBlob));
  const name = profile.name.some((p) => p.test(nameBlob));
  const description = profile.description.some((p) => p.test(descBlob));

  let score = 0;
  if (fsq) score += 10;
  if (name) score += 6;
  if (description) score += 4;
  if (name && profile.strongName?.test(nameBlob)) score += 8;

  return { profile, score, fsq, name, description };
}

/** Misleading Foursquare-only tags contradicted by the business name. */
const FSQ_OVERRIDDEN_BY_NAME: Partial<Record<EditorialCategoryId, RegExp>> = {
  beach: /country club|golf club|rock shop|gem shop|restaurant|neighborhood|coffee|café|cafe|dog park|observatory|planetarium|bowling|escape room|winery|vineyard/i,
  playground: /dog park|cosmo dog/i,
  scenic_drive: /observatory|planetarium|museum|restaurant|coffee|dog park|bowling|escape room/i,
  museum: /rock shop|gem shop|natural expressions/i,
  park: /restaurant|coffee shop|bowling|escape room|observatory/i,
};

function fsqContradictedByName(
  categoryId: EditorialCategoryId,
  nameBlob: string,
  descBlob: string
): boolean {
  const pattern = FSQ_OVERRIDDEN_BY_NAME[categoryId];
  if (!pattern) return false;
  return pattern.test(`${nameBlob} ${descBlob}`);
}

function qualifiesMatch(scored: Scored, nameBlob: string): boolean {
  const { profile, fsq, name, description } = scored;
  if (fsq) return true;
  if (name && description) return true;
  if (name && profile.strongName?.test(nameBlob)) return true;
  return false;
}

export function resolveVerifiedEditorialCategory(
  input: EditorialCategoryInput
): VerifiedEditorialCategory {
  const nameBlob = input.title?.trim() ?? "";
  const descBlob = input.dek?.trim() ?? "";
  const ranked = PROFILES.map((p) => scoreProfile(p, input))
    .filter((s) => s.score > 0 && qualifiesMatch(s, nameBlob))
    .filter(
      (s) =>
        !(
          s.fsq &&
          !s.name &&
          !s.description &&
          fsqContradictedByName(s.profile.id, nameBlob, descBlob)
        )
    )
    .sort((a, b) => b.score - a.score);

  let best = ranked[0];
  const strongNameMatch = ranked.find(
    (s) => s.name && s.profile.strongName?.test(nameBlob)
  );
  if (
    best &&
    best.fsq &&
    !best.name &&
    !best.description &&
    strongNameMatch &&
    strongNameMatch.score >= best.score
  ) {
    best = strongNameMatch;
  }
  if (best) {
    const sources: VerifiedEditorialCategory["sources"] = [];
    if (best.fsq) sources.push("foursquare");
    if (best.name) sources.push("name");
    if (best.description) sources.push("description");

    let confidence: VerifiedEditorialCategory["confidence"] = "tentative";
    if (best.fsq && (best.name || best.description)) confidence = "verified";
    else if (best.fsq || (best.name && best.description)) confidence = "verified";
    else if (best.name && best.profile.strongName?.test(nameBlob)) {
      confidence = "verified";
    } else if (best.name && best.description) confidence = "likely";

    return {
      categoryId: best.profile.id,
      displayLabel: best.profile.displayLabel,
      imageTag: best.profile.imageTag,
      confidence,
      sources,
    };
  }

  const fallback = input.discoveryCategory
    ? DISCOVERY_FALLBACK[input.discoveryCategory]
    : undefined;
  if (fallback) {
    const profile = PROFILE_BY_ID.get(fallback.id)!;
    return {
      categoryId: fallback.id,
      displayLabel: fallback.label,
      imageTag: profile.imageTag,
      confidence: "tentative",
      sources: [],
    };
  }

  return {
    categoryId: "general_place",
    displayLabel: "local place",
    imageTag: "general_activity",
    confidence: "tentative",
    sources: [],
  };
}

export function editorialCopyConflicts(
  categoryId: EditorialCategoryId,
  text: string
): boolean {
  const profile = PROFILE_BY_ID.get(categoryId);
  if (!profile || !text.trim()) return false;
  return profile.forbiddenCopy.some((p) => p.test(text));
}

export function sanitizeEditorialParagraphs(
  categoryId: EditorialCategoryId,
  paragraphs: string[]
): string[] {
  return paragraphs.filter((p) => !editorialCopyConflicts(categoryId, p));
}

export function validateEditorialArticle(input: {
  categoryId: EditorialCategoryId;
  dek?: string | null;
  body: string[];
}): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  const check = (text: string) => {
    if (editorialCopyConflicts(input.categoryId, text)) {
      conflicts.push(text.slice(0, 120));
    }
  };
  if (input.dek) check(input.dek);
  for (const p of input.body) check(p);
  return { valid: conflicts.length === 0, conflicts };
}

export function editorialImagePhrasesFor(
  categoryId: EditorialCategoryId
): string[] {
  return PROFILE_BY_ID.get(categoryId)?.imagePhrases ?? ["local place exterior"];
}

export function buildCategoryImageSearchQueries(input: {
  title: string;
  city?: string | null;
  state?: string | null;
  category: VerifiedEditorialCategory;
}): string[] {
  const title = input.title.trim();
  const city = input.city?.trim() || "";
  const state = input.state?.trim() || "";
  const label = input.category.displayLabel;
  const profile = PROFILE_BY_ID.get(input.category.categoryId);
  const phrases = profile?.imagePhrases ?? ["local place exterior"];

  const queries: string[] = [];
  if (title && city) {
    queries.push([title, city, state].filter(Boolean).join(" "));
  }
  if (title && label) {
    queries.push(`${title} ${label}`);
  }
  for (const phrase of phrases) {
    queries.push(phrase);
    if (city) queries.push(`${phrase} ${city}`);
  }
  return [...new Set(queries.filter((q) => q.trim().length >= 3))];
}

export function stockTagsConflictWithCategory(
  categoryId: EditorialCategoryId,
  tags: string[],
  alt?: string | null
): boolean {
  const hay = [...tags, alt ?? ""].join(" ");
  const profile = PROFILE_BY_ID.get(categoryId);
  if (!profile) return false;
  return profile.forbiddenCopy.some((p) => p.test(hay));
}
