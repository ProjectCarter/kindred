/**
 * Discovery Engine — editorial recommendations for Kindred.
 * Hand-selected by an experienced newspaper editor — not a feed, not an algorithm.
 *
 * Powers future surfaces: Bandit's Picks, Weekend Ideas, Hidden Gems,
 * Coffee, Restaurants, Beaches, Hiking, Museums, Parks, Scenic Drives,
 * Books, Movies, Podcasts, Recipes.
 */

export type DiscoverySurface =
  | "bandits_picks"
  | "weekend_ideas"
  | "hidden_gems"
  | "coffee"
  | "restaurants"
  | "beaches"
  | "hiking"
  | "museums"
  | "parks"
  | "scenic_drives"
  | "books"
  | "movies"
  | "podcasts"
  | "recipes";

export type DiscoveryCategory =
  | "coffee"
  | "restaurants"
  | "recipes"
  | "beaches"
  | "hiking"
  | "parks"
  | "scenic_drives"
  | "museums"
  | "books"
  | "movies"
  | "podcasts"
  | "experiences"
  | "travel";

export type DiscoveryFamily =
  | "food_drink"
  | "outdoors"
  | "culture_leisure"
  | "travel";

export type DiscoveryReason = {
  code: string;
  label: string;
  weight: number;
};

/** Canonical recommendation item — section-agnostic. */
export type DiscoveryItem = {
  id: string;
  title: string;
  dek: string;
  category: DiscoveryCategory;
  family: DiscoveryFamily;
  /** Where this recommendation applies; null = broadly relevant. */
  place?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  source: {
    name: string;
    tier: "wire" | "guide" | "magazine" | "local" | "kindred";
    url?: string | null;
  };
  /** Optional deep link or original article. */
  url?: string | null;
  tags: string[];
  /** Season tags: spring | summer | autumn | winter | anytime */
  seasons: string[];
  /** Weather fit: fair | cool | rainy | any */
  weatherFit: string[];
  /** Soft popularity prior 0–1 (editorial, not social proof spam). */
  popularity: number;
  /** Soft uniqueness prior 0–1 — hidden gems score higher. */
  uniqueness: number;
  /** Local expertise prior 0–1. */
  localExpertise: number;
  /** Editorial quality prior 0–1. */
  quality: number;
};

export type RankedDiscoveryItem = {
  item: DiscoveryItem;
  score: number;
  reasons: DiscoveryReason[];
  surfaces: DiscoverySurface[];
};

export type DiscoverySurfaceResult = {
  surface: DiscoverySurface;
  headline: string;
  editorNote: string;
  items: RankedDiscoveryItem[];
};

export type DiscoveryPayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  surfaces: Partial<Record<DiscoverySurface, DiscoverySurfaceResult>>;
  /** Flat list of all selected items for Bandit / AI. */
  picks: Array<{
    id: string;
    title: string;
    category: DiscoveryCategory;
    surface: DiscoverySurface;
    why: string;
  }>;
  editorBrief: string;
  selectionMeta: {
    candidateCount: number;
    selectedCount: number;
    editorNotes: string[];
  };
};

export type DiscoveryRankingContext = {
  editionDate: string;
  now?: Date;
  city: string | null;
  region: string | null;
  state: string | null;
  interests: string[];
  followedTopics: string[];
  favoriteSources: string[];
  weatherSummary?: string | null;
  isWeekend?: boolean;
  isSunday?: boolean;
  season?: "spring" | "summer" | "autumn" | "winter";
  /** Recent discovery titles / ids for anti-repetition. */
  recentKeys?: string[];
  /** Local events from the edition — become discovery candidates. */
  localEvents?: Array<{
    name: string;
    startDateTime: string;
    venue: string;
    city: string;
    sourceUrl?: string;
    sourceName?: string;
  }>;
  /** Which surfaces to assemble this edition. */
  surfaces?: DiscoverySurface[];
  maxPerSurface?: number;
};
