/**
 * Resolve which editorial template a piece of content should use.
 * Explicit contentType wins; otherwise infer from section, category, tags, and copy.
 */

import type { DiscoveryCategory } from "../discovery";
import type { ContentType } from "./types";

const DISCOVERY_CATEGORY_MAP: Partial<Record<DiscoveryCategory, ContentType>> = {
  coffee: "coffee",
  restaurants: "restaurant",
  beaches: "beach",
  hiking: "hiking",
  parks: "park",
  scenic_drives: "travel",
  museums: "museum",
  books: "recommendation",
  movies: "recommendation",
  podcasts: "recommendation",
  recipes: "recommendation",
  experiences: "hidden_gem",
  travel: "travel",
};

const SECTION_MAP: Record<string, ContentType> = {
  lead: "news",
  top_stories: "news",
  science: "science",
  today_in_history: "history",
  looking_ahead: "local_news",
  discovery: "recommendation",
  knowledge: "recommendation",
  bandits_pick: "recommendation",
  local_events: "local_event",
  business: "news",
  health: "news",
  culture: "news",
  technology: "science",
  sports: "news",
  cooking: "recommendation",
};

export type ResolveContentTypeInput = {
  contentType?: ContentType | null;
  section?: string | null;
  discoveryCategory?: string | null;
  tags?: string[] | null;
  headline?: string | null;
  role?: string | null;
};

/**
 * Pick the editorial template for a piece of Kindred content.
 */
export function resolveContentType(input: ResolveContentTypeInput): ContentType {
  if (input.contentType && isContentType(input.contentType)) {
    return input.contentType;
  }

  const hay = [
    input.headline,
    ...(input.tags ?? []),
    input.discoveryCategory,
    input.section,
    input.role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Place & experience cues before generic section maps.
  if (/festival|fair|parade|carnival/.test(hay)) return "festival";
  if (/bakery|pastry|croissant|sourdough|patisserie/.test(hay)) return "bakery";
  if (/coffee|café|cafe|espresso|latte/.test(hay)) return "coffee";
  if (/restaurant|dinner|bistro|tavern|eatery|dining/.test(hay))
    return "restaurant";
  if (/hike|trail|ridge|summit|switchback/.test(hay)) return "hiking";
  if (/beach|shore|coast|surf|cove/.test(hay)) return "beach";
  if (/museum|gallery|exhibit/.test(hay)) return "museum";
  if (/park|arboretum|botanical|garden green/.test(hay)) return "park";
  if (/hidden gem|side street|speakeasy|unmarked/.test(hay)) return "hidden_gem";
  if (/day trip|weekend getaway|road trip|destination/.test(hay))
    return "travel";
  if (/attraction|zoo|aquarium|theme park|observatory/.test(hay))
    return "attraction";

  if (input.discoveryCategory) {
    const mapped =
      DISCOVERY_CATEGORY_MAP[
        input.discoveryCategory as DiscoveryCategory
      ];
    if (mapped) return mapped;
  }

  if (input.role && /local/i.test(input.role)) return "local_news";

  if (input.section && SECTION_MAP[input.section]) {
    return SECTION_MAP[input.section];
  }

  return "news";
}

export function isContentType(value: string): value is ContentType {
  return (
    value === "news" ||
    value === "local_news" ||
    value === "science" ||
    value === "history" ||
    value === "local_event" ||
    value === "festival" ||
    value === "restaurant" ||
    value === "coffee" ||
    value === "bakery" ||
    value === "hiking" ||
    value === "park" ||
    value === "beach" ||
    value === "museum" ||
    value === "attraction" ||
    value === "hidden_gem" ||
    value === "recommendation" ||
    value === "travel"
  );
}

export function categoryLabelForType(type: ContentType): string {
  const labels: Record<ContentType, string> = {
    news: "News",
    local_news: "Local",
    science: "Science",
    history: "History",
    local_event: "Local Event",
    festival: "Festival",
    restaurant: "Table",
    coffee: "Coffee",
    bakery: "Bakery",
    hiking: "Trails",
    park: "Parks",
    beach: "Beaches",
    museum: "Museums",
    attraction: "Attractions",
    hidden_gem: "Hidden gems",
    recommendation: "From the desk",
    travel: "Travel",
  };
  return labels[type];
}
