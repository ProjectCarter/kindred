/**
 * Client mirror of supabase/functions/_shared/heroArtwork/collections.ts — keep in sync.
 */

export type HeroArtworkCollectionId =
  | "impressionism"
  | "dutch_masters"
  | "renaissance"
  | "baroque"
  | "ukiyo_e"
  | "american_realism"
  | "romanticism"
  | "art_nouveau"
  | "botanical_illustration"
  | "scientific_illustration"
  | "historic_engravings"
  | "historic_maps"
  | "wpa_travel_posters"
  | "vintage_travel_posters"
  | "national_parks"
  | "nasa"
  | "smithsonian"
  | "library_of_congress"
  | "museum_open_access"
  | "seasonal_spring"
  | "seasonal_summer"
  | "seasonal_autumn"
  | "seasonal_winter"
  | "holiday_winter"
  | "holiday_summer";

export type HeroArtworkCollection = {
  id: HeroArtworkCollectionId;
  title: string;
  description: string;
};

/** Collection ids only on client — full registry lives server-side. */
export const HERO_ARTWORK_COLLECTION_IDS: HeroArtworkCollectionId[] = [
  "impressionism",
  "dutch_masters",
  "renaissance",
  "baroque",
  "ukiyo_e",
  "american_realism",
  "romanticism",
  "art_nouveau",
  "botanical_illustration",
  "scientific_illustration",
  "historic_engravings",
  "historic_maps",
  "wpa_travel_posters",
  "vintage_travel_posters",
  "national_parks",
  "nasa",
  "smithsonian",
  "library_of_congress",
  "museum_open_access",
  "seasonal_spring",
  "seasonal_summer",
  "seasonal_autumn",
  "seasonal_winter",
  "holiday_winter",
  "holiday_summer",
];

export function primaryCollection(
  collections: HeroArtworkCollectionId[]
): HeroArtworkCollectionId | null {
  return collections[0] ?? null;
}
