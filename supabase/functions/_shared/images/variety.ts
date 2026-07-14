import type { ImageCategoryTag } from "./taxonomy.ts";
import type { StockSearchCandidate } from "./types.ts";

/** Visual composition slot — rotates within a category so five coffee shops don't all look identical. */
export type CompositionSlot = string;

/**
 * Editorial composition rotation per category. Each slot becomes part of the
 * search query and is stored on the library row for dedup within an edition.
 */
export const COMPOSITION_ROTATION: Partial<
  Record<ImageCategoryTag, CompositionSlot[]>
> = {
  coffee_shop: [
    "storefront",
    "latte_art",
    "barista",
    "pastries",
    "outdoor_seating",
    "interior",
    "roasting",
    "neighborhood",
  ],
  restaurant: [
    "dining_room",
    "chef_plating",
    "exterior",
    "bar",
    "patio",
    "dessert",
  ],
  bakery: ["display_case", "fresh_bread", "pastry", "storefront", "baker"],
  park: ["trail", "meadow", "playground", "pond", "trees", "picnic"],
  museum: ["gallery", "exhibit", "facade", "sculpture", "visitor"],
  hiking: ["trail", "summit", "forest", "ridge", "backpack"],
  beach: ["shoreline", "waves", "boardwalk", "sunset", "sand"],
  lake: ["dock", "kayak", "shoreline", "sunset", "pier"],
  bowling: ["lanes", "strike", "shoes", "neon_interior"],
  escape_room: ["puzzle", "team", "locked_door", "clues"],
  library: ["reading_room", "bookshelves", "study", "facade"],
  farmers_market: ["produce", "vendor", "flowers", "crowd"],
  general_activity: ["venue", "people", "detail", "exterior"],
};

const SLOT_QUERY_PHRASES: Record<string, string> = {
  storefront: "storefront exterior",
  latte_art: "latte art close up",
  barista: "barista pouring coffee",
  pastries: "pastry display case",
  outdoor_seating: "outdoor cafe seating",
  interior: "cafe interior",
  roasting: "coffee roasting",
  neighborhood: "neighborhood coffee shop",
  dining_room: "restaurant dining room",
  chef_plating: "chef plating food",
  exterior: "restaurant exterior",
  bar: "restaurant bar",
  patio: "restaurant patio",
  dessert: "restaurant dessert",
  display_case: "bakery display",
  fresh_bread: "fresh baked bread",
  pastry: "pastry close up",
  baker: "baker at work",
  trail: "nature trail",
  meadow: "open meadow",
  playground: "playground",
  pond: "park pond",
  trees: "tree canopy",
  picnic: "picnic in park",
  gallery: "art gallery interior",
  exhibit: "museum exhibit",
  facade: "museum facade",
  sculpture: "museum sculpture",
  visitor: "museum visitors",
  summit: "mountain summit view",
  forest: "forest trail",
  ridge: "mountain ridge",
  backpack: "hiker backpack trail",
  shoreline: "lake shoreline",
  waves: "ocean waves",
  boardwalk: "beach boardwalk",
  sunset: "sunset golden hour",
  sand: "sandy beach",
  dock: "lake dock",
  kayak: "kayak on lake",
  pier: "lake pier",
  lanes: "bowling lanes",
  strike: "bowling strike",
  shoes: "bowling shoes",
  neon_interior: "bowling alley neon",
  puzzle: "escape room puzzle",
  team: "friends escape room",
  locked_door: "mysterious door",
  clues: "puzzle clues table",
  reading_room: "library reading room",
  bookshelves: "library bookshelves",
  study: "quiet study desk",
  produce: "farmers market produce",
  vendor: "market vendor stall",
  flowers: "flower bouquet market",
  crowd: "farmers market crowd",
  venue: "local venue",
  people: "people enjoying activity",
  detail: "interesting detail",
};

export function pickCompositionSlot(
  category: ImageCategoryTag,
  slotIndex: number
): CompositionSlot {
  const rotation = COMPOSITION_ROTATION[category] ??
    COMPOSITION_ROTATION.general_activity ??
    ["venue"];
  return rotation[slotIndex % rotation.length];
}

export function compositionSearchQuery(
  baseQuery: string,
  slot: CompositionSlot
): string {
  const phrase = SLOT_QUERY_PHRASES[slot] ?? slot.replace(/_/g, " ");
  return `${baseQuery} ${phrase}`.trim();
}

/** Infer composition from provider tags so ingested rows carry variety metadata. */
export function inferCompositionTag(
  category: ImageCategoryTag,
  tags: string[]
): CompositionSlot | null {
  const rotation = COMPOSITION_ROTATION[category] ??
    COMPOSITION_ROTATION.general_activity ??
    [];
  const hay = tags.join(" ").toLowerCase();
  for (const slot of rotation) {
    const phrase = (SLOT_QUERY_PHRASES[slot] ?? slot.replace(/_/g, " ")).toLowerCase();
    const tokens = phrase.split(/\s+/).filter((t) => t.length > 3);
    if (tokens.some((token) => hay.includes(token))) return slot;
  }
  return rotation[0] ?? null;
}

/** Placeholder for future dominant-color extraction — stored for edition dedup. */
export function inferDominantColor(tags: string[]): string | null {
  const hay = tags.join(" ").toLowerCase();
  const colors = [
    "warm",
    "cool",
    "golden",
    "green",
    "blue",
    "earth",
    "neutral",
    "vibrant",
  ];
  return colors.find((c) => hay.includes(c)) ?? null;
}

export type VarietyFitInput = {
  compositionTag?: string | null;
  dominantSubject?: string | null;
  dominantColor?: string | null;
  contentHash?: string | null;
  photographerName?: string | null;
};

export function varietyCollisionPenalty(
  candidate: VarietyFitInput,
  used: {
    compositions: Set<string>;
    subjects: Set<string>;
    colors: Set<string>;
    hashes: Set<string>;
    photographers: Set<string>;
  }
): number {
  let penalty = 0;
  if (candidate.compositionTag && used.compositions.has(candidate.compositionTag)) {
    penalty += 25;
  }
  if (candidate.dominantSubject && used.subjects.has(candidate.dominantSubject)) {
    penalty += 15;
  }
  if (candidate.dominantColor && used.colors.has(candidate.dominantColor)) {
    penalty += 12;
  }
  if (candidate.contentHash && used.hashes.has(candidate.contentHash)) {
    penalty += 100;
  }
  if (
    candidate.photographerName &&
    used.photographers.has(candidate.photographerName.trim().toLowerCase())
  ) {
    penalty += 20;
  }
  return penalty;
}

export function rankStockCandidates(
  candidates: StockSearchCandidate[],
  baseQuality: (c: StockSearchCandidate) => number,
  used: {
    compositions: Set<string>;
    subjects: Set<string>;
    colors: Set<string>;
    hashes: Set<string>;
    photographers: Set<string>;
  },
  compositionTag: CompositionSlot,
  category?: ImageCategoryTag
): StockSearchCandidate[] {
  return [...candidates].sort((a, b) => {
    const inferredA = category
      ? inferCompositionTag(category, a.tags) ?? compositionTag
      : compositionTag;
    const inferredB = category
      ? inferCompositionTag(category, b.tags) ?? compositionTag
      : compositionTag;

    const scoreA =
      baseQuality(a) -
      varietyCollisionPenalty(
        {
          compositionTag: inferredA,
          dominantSubject: inferredA,
          dominantColor: inferDominantColor(a.tags),
          photographerName: a.photographerName,
        },
        used
      );
    const scoreB =
      baseQuality(b) -
      varietyCollisionPenalty(
        {
          compositionTag: inferredB,
          dominantSubject: inferredB,
          dominantColor: inferDominantColor(b.tags),
          photographerName: b.photographerName,
        },
        used
      );
    return scoreB - scoreA;
  });
}
