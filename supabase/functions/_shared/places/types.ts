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
  | "attractions";

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
  lat: number | null;
  lon: number | null;
  /** Link back to the provider listing — required for the truthfulness gate. */
  url: string | null;
  /** Provider-supplied categories/tags, kept for editorial context only. */
  providerCategories: string[];
  /** Present only when the provider actually returned one — never invented. */
  rating: number | null;
  priceTier: number | null;
  /** Kindred's own one- or two-sentence note, written from the fields above. */
  note?: string | null;
};

export type PlacesSearchResult = {
  places: NormalizedPlace[];
  /** Raw candidate count before any filtering — observability only. */
  candidateCount: number;
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
