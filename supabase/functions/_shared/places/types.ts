/**
 * Local-places provider abstraction.
 *
 * Kindred never talks to Foursquare (or any provider) directly from the
 * discovery pipeline. Everything upstream — caching, editorial notes,
 * Discovery Engine wiring — only ever sees `NormalizedPlace`. Swapping in
 * Google Places later (fallback or replacement) means writing one new
 * `PlacesProvider` implementation; nothing else changes.
 */

/** The categories Kindred actually asks a places provider for. */
export type PlacesCategory =
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
  // — Activities desk ("what should I go do?") — real, bookable venues for
  // active participation, not just places to look at. See
  // foursquareProvider.ts for which of these have a verified Foursquare
  // category id vs. remain query-only (no memorized id verified yet).
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

export type PlacesLocation = {
  lat: number;
  lon: number;
  city: string;
  region?: string | null;
  state?: string | null;
};

/**
 * Provider-agnostic place record. Every field here must trace back to the
 * provider's response — nothing here is ever written by Kindred's editors.
 * Kindred's own voice is layered on separately as `note` (see notes.ts),
 * clearly generated FROM these facts, never in place of them.
 */
export type NormalizedPlace = {
  /** Stable id from the provider (e.g. Foursquare fsq_id) — dedupe key. */
  providerId: string;
  name: string;
  category: PlacesCategory;
  address: string | null;
  city: string | null;
  /** State / region code from the provider when available. */
  state: string | null;
  lat: number | null;
  lon: number | null;
  /** Link back to the provider listing — required for the truthfulness gate. */
  url: string | null;
  /** Provider-supplied categories/tags, kept for editorial context only. */
  providerCategories: string[];
  /** Present only when the provider actually returned one — never invented. */
  rating: number | null;
  priceTier: number | null;
  /** Kindred editorial score (0–100) — separate from provider rating. */
  editorialScore?: number | null;
  /** Structured editorial label ids. */
  editorialLabels?: string[];
  /** Permanent Kindred venue UUID when loaded from catalog. */
  kindredVenueId?: string | null;
  /** Kindred's one-sentence editorial note (see notes.ts) — homepage card blurb. */
  note?: string | null;
  /**
   * Kindred's 1–2 paragraph editorial "About" summary (see notes.ts), grounded
   * in the same verified facts as `note`. Persisted in the `editorial_article`
   * catalog column. Never verbatim provider text; null when not yet generated.
   */
  about?: string | null;
};

export type PlacesSearchResult = {
  places: NormalizedPlace[];
  /** Raw API rows returned across all pages (includes duplicate ids). */
  candidateCount: number;
  /** Unique provider ids after merge — editorial catalog size. */
  uniqueCount: number;
  /** Pages fetched from Foursquare for this category search. */
  pageCount: number;
};

/** Every provider (Foursquare today, Google Places tomorrow) implements this. */
export interface PlacesProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  search(
    location: PlacesLocation,
    category: PlacesCategory
  ): Promise<PlacesSearchResult>;
}
