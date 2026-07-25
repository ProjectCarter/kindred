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
  | "recipes"
  | "activities"
  | "bakeries"
  | "gardens";

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
  | "travel"
  // "What should I go do?" — real, bookable venues for active participation
  // (kayaking, escape rooms, bowling, mini golf, rock climbing, axe
  // throwing, go-karts, pickleball). Collapsed into one category here —
  // the specific kind of venue still comes through on each item's
  // `venueCategories` (Foursquare's own label, e.g. "Bowling Alley").
  | "activities"
  | "bakeries"
  | "gardens";

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
  /**
   * Kindred's 1–2 paragraph grounded editorial "About" summary, when generated.
   * Separate from `dek` (the one-line card blurb). Never verbatim provider text.
   */
  about?: string | null;
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
  /** Organizer or venue official site — never a listing aggregator. */
  officialWebsite?: string | null;
  /** Verified street address (local places only) — never fabricated. */
  address?: string | null;
  /** Verified coordinates from provider data — never fabricated. */
  lat?: number | null;
  lon?: number | null;
  /** Provider relevance confidence 0–1 (NPS distance, etc.) — never fabricated. */
  providerConfidence?: number | null;
  /** Provider-supplied category names (e.g. Foursquare "Coffee Shop") — editorial context only, never invented. */
  venueCategories?: string[];
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
  /** Server-enriched Kindred library / stock photo (never searched client-side). */
  editorialImage?: {
    url: string;
    libraryId: string;
    source: "pexels" | "pixabay" | "unsplash" | "wikimedia" | "provider" | "kindred";
    orientation?: "portrait" | "landscape" | "square";
    photographerName?: string | null;
    sourcePageUrl?: string | null;
    attributionText?: string | null;
  } | null;
  /** Wikipedia grounding for museum/landmark briefings — not attached to local businesses. */
  knowledgeGrounding?: import("../knowledge/providers/types.ts").KnowledgeLookupResult | null;
  /** Internal editorial confidence — never shown to readers. */
  editorialConfidence?: import("../editorial/confidence.ts").EditorialConfidence | null;
  /** Kindred Venue Editorial Score — recommendation strength, not provider rating. */
  venueEditorial?: {
    score: number;
    labels: string[];
    kindredVenueId?: string | null;
  } | null;
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
    /** Edition center — used for local Recommendations radius. */
    lat?: number | null;
    lon?: number | null;
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
    /** Candidates scoring 70–79 held for enrichment before publication. */
    enrichQueue?: DiscoveryItem[];
    /** ISO timestamp when a post-enrichment confidence prune last ran. */
    confidencePrunedAt?: string | null;
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
  /** Structured weather signals from WeatherProvider — optional enrichment. */
  weatherIntel?: import("../weather/providers/types.ts").WeatherIntelligence | null;
  /** Reader coordinates for proximity scoring — never fabricated. */
  readerLat?: number | null;
  readerLon?: number | null;
  /** NPS parks near the reader — become hiking / scenic discovery candidates. */
  npsParks?: import("../nps/types.ts").NpsParkRecord[];
  /** Local events from the edition — become discovery candidates. */
  localEvents?: Array<{
    name: string;
    startDateTime: string;
    venue: string;
    city: string;
    sourceUrl?: string;
    sourceName?: string;
    officialWebsite?: string | null;
  }>;
  /**
   * Verified local places (Foursquare today) — become discovery candidates
   * for Recommendations/Weekend Escapes/Notebook. Cached per metro, so this
   * list is shared across every reader in the same city, not fetched here.
   */
  localPlaces?: Array<{
    providerId: string;
    name: string;
    category:
      | "coffee"
      | "restaurants"
      | "parks"
      | "museums"
      | "bookstores"
      | "scenic_drives"
      | "attractions"
      | "bakeries"
      | "gardens"
      | "beaches"
      | "water_recreation"
      | "escape_rooms"
      | "bowling"
      | "mini_golf"
      | "rock_climbing"
      | "axe_throwing"
      | "go_karts"
      | "pickleball"
      | "arcades"
      | "laser_tag"
      | "paintball"
      | "billiards"
      | "roller_skating"
      | "ice_skating"
      | "karaoke"
      | "batting_cages";
    address: string | null;
    city: string | null;
    url: string | null;
    officialWebsite?: string | null;
    note?: string | null;
    /** Provider-supplied category names — passed through for richer article grounding. */
    providerCategories?: string[];
  }>;
  /** Which surfaces to assemble this edition. */
  surfaces?: DiscoverySurface[];
  /** Minimum score to publish on a discovery surface — quality gate, not a count cap. */
  publishMinScore?: number;
  /** @deprecated Use publishMinScore — arbitrary per-surface counts are no longer enforced. */
  maxPerSurface?: number;
};
