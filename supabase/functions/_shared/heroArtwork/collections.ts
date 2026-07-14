import type { HeroArtworkSeason, HeroArtworkHoliday, HeroArtworkSourceProvider } from "./types.ts";

/**
 * Editorial collections — the library grows by collection, not by fixed counts.
 * New artworks register into one or more collections without redesigning selection.
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
  parentCollectionId?: HeroArtworkCollectionId;
  seasonalAffinity: HeroArtworkSeason[];
  holidayAffinity: HeroArtworkHoliday[];
  providerAffinity: HeroArtworkSourceProvider[];
  editorialPriority: number;
};

export const HERO_ARTWORK_COLLECTIONS: Record<
  HeroArtworkCollectionId,
  HeroArtworkCollection
> = {
  impressionism: {
    id: "impressionism",
    title: "Impressionism",
    description: "Light, atmosphere, and modern life — Monet, Renoir, Degas, and their circle.",
    seasonalAffinity: ["spring", "summer"],
    holidayAffinity: [],
    providerAffinity: ["met", "national_gallery_art", "art_institute_chicago"],
    editorialPriority: 85,
  },
  dutch_masters: {
    id: "dutch_masters",
    title: "Dutch Masters",
    description: "Golden Age clarity — Vermeer, Rembrandt, and the quiet drama of Northern light.",
    seasonalAffinity: ["autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["rijksmuseum", "met", "national_gallery_art"],
    editorialPriority: 90,
  },
  renaissance: {
    id: "renaissance",
    title: "Renaissance",
    description: "Humanism, perspective, and sacred stillness from Italy and Northern Europe.",
    seasonalAffinity: ["spring", "autumn"],
    holidayAffinity: ["easter"],
    providerAffinity: ["met", "national_gallery_art", "rijksmuseum"],
    editorialPriority: 88,
  },
  baroque: {
    id: "baroque",
    title: "Baroque",
    description: "Theatrical light, movement, and grandeur.",
    seasonalAffinity: ["autumn", "winter"],
    holidayAffinity: ["christmas"],
    providerAffinity: ["met", "national_gallery_art", "rijksmuseum"],
    editorialPriority: 82,
  },
  ukiyo_e: {
    id: "ukiyo_e",
    title: "Ukiyo-e",
    description: "Japanese woodblock elegance — Hokusai, Hiroshige, and the floating world.",
    seasonalAffinity: ["spring", "summer"],
    holidayAffinity: [],
    providerAffinity: ["met", "smithsonian", "wikimedia"],
    editorialPriority: 86,
  },
  american_realism: {
    id: "american_realism",
    title: "American Realism",
    description: "Hopper, Homer, Cassatt — honest American light and everyday dignity.",
    seasonalAffinity: ["summer", "autumn"],
    holidayAffinity: ["independence_day", "labor_day"],
    providerAffinity: ["national_gallery_art", "smithsonian", "art_institute_chicago"],
    editorialPriority: 84,
  },
  romanticism: {
    id: "romanticism",
    title: "Romanticism",
    description: "Sublime landscapes, emotion, and the individual against nature.",
    seasonalAffinity: ["autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["met", "national_gallery_art", "wikimedia"],
    editorialPriority: 80,
  },
  art_nouveau: {
    id: "art_nouveau",
    title: "Art Nouveau",
    description: "Organic line, decorative beauty — Mucha and the Belle Époque.",
    seasonalAffinity: ["spring"],
    holidayAffinity: ["valentines"],
    providerAffinity: ["national_gallery_art", "smithsonian", "loc"],
    editorialPriority: 78,
  },
  botanical_illustration: {
    id: "botanical_illustration",
    title: "Botanical Illustration",
    description: "Scientific precision rendered as quiet beauty.",
    seasonalAffinity: ["spring", "summer"],
    holidayAffinity: ["easter"],
    providerAffinity: ["loc", "smithsonian", "national_gallery_art"],
    editorialPriority: 76,
  },
  scientific_illustration: {
    id: "scientific_illustration",
    title: "Scientific Illustration",
    description: "Natural history, astronomy, and discovery drawn for the curious eye.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["smithsonian", "nasa", "loc"],
    editorialPriority: 74,
  },
  historic_engravings: {
    id: "historic_engravings",
    title: "Historic Engravings",
    description: "Etched architecture, city views, and documentary craft.",
    seasonalAffinity: ["autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["loc", "met", "national_archives"],
    editorialPriority: 72,
  },
  historic_maps: {
    id: "historic_maps",
    title: "Historic Maps",
    description: "Cartography as art — borders, coastlines, and the world as it was understood.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["loc", "national_archives", "smithsonian"],
    editorialPriority: 70,
  },
  wpa_travel_posters: {
    id: "wpa_travel_posters",
    title: "WPA Travel Posters",
    description: "American optimism in print — parks, rails, and the open road.",
    seasonalAffinity: ["summer"],
    holidayAffinity: ["memorial_day", "labor_day"],
    providerAffinity: ["loc", "smithsonian"],
    editorialPriority: 75,
  },
  vintage_travel_posters: {
    id: "vintage_travel_posters",
    title: "Vintage Travel Posters",
    description: "Invitation to elsewhere — graphic posters from another era of travel.",
    seasonalAffinity: ["summer", "spring"],
    holidayAffinity: [],
    providerAffinity: ["loc", "smithsonian"],
    editorialPriority: 73,
  },
  national_parks: {
    id: "national_parks",
    title: "National Parks",
    description: "America's protected landscapes — grandeur meant to be shared.",
    seasonalAffinity: ["summer", "autumn"],
    holidayAffinity: ["memorial_day", "labor_day"],
    providerAffinity: ["loc", "nasa", "smithsonian"],
    editorialPriority: 77,
  },
  nasa: {
    id: "nasa",
    title: "NASA",
    description: "Earth from above, deep space, and the poetry of exploration.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["nasa"],
    editorialPriority: 79,
  },
  smithsonian: {
    id: "smithsonian",
    title: "Smithsonian",
    description: "America's attic — art, science, and history under open access.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["smithsonian"],
    editorialPriority: 81,
  },
  library_of_congress: {
    id: "library_of_congress",
    title: "Library of Congress",
    description: "Posters, maps, prints, and documentary treasures.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: ["loc"],
    editorialPriority: 80,
  },
  museum_open_access: {
    id: "museum_open_access",
    title: "Museum Open Access",
    description: "Verified open-access holdings from the world's great institutions.",
    seasonalAffinity: ["spring", "summer", "autumn", "winter"],
    holidayAffinity: [],
    providerAffinity: [
      "met",
      "national_gallery_art",
      "rijksmuseum",
      "smithsonian",
      "art_institute_chicago",
    ],
    editorialPriority: 83,
  },
  seasonal_spring: {
    id: "seasonal_spring",
    title: "Spring Collection",
    description: "Renewal, blossom, and the first warm light of the year.",
    seasonalAffinity: ["spring"],
    holidayAffinity: ["easter", "st_patricks"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 65,
  },
  seasonal_summer: {
    id: "seasonal_summer",
    title: "Summer Collection",
    description: "Long days, open water, and golden leisure.",
    seasonalAffinity: ["summer"],
    holidayAffinity: ["independence_day", "memorial_day", "labor_day"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 65,
  },
  seasonal_autumn: {
    id: "seasonal_autumn",
    title: "Autumn Collection",
    description: "Harvest color, reflection, and the year's turning.",
    seasonalAffinity: ["autumn"],
    holidayAffinity: ["halloween", "thanksgiving"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 65,
  },
  seasonal_winter: {
    id: "seasonal_winter",
    title: "Winter Collection",
    description: "Stillness, frost, and the comfort of indoor light.",
    seasonalAffinity: ["winter"],
    holidayAffinity: ["christmas", "new_year", "new_years_eve"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 65,
  },
  holiday_winter: {
    id: "holiday_winter",
    title: "Holiday Collection",
    description: "December rituals — warmth without spectacle.",
    seasonalAffinity: ["winter"],
    holidayAffinity: ["christmas", "new_year", "new_years_eve"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 68,
  },
  holiday_summer: {
    id: "holiday_summer",
    title: "Summer Holidays",
    description: "Independence, remembrance, and the long weekend.",
    seasonalAffinity: ["summer"],
    holidayAffinity: ["independence_day", "memorial_day", "labor_day"],
    providerAffinity: ["kindred_curated"],
    editorialPriority: 66,
  },
};

export function getCollection(
  id: HeroArtworkCollectionId
): HeroArtworkCollection {
  return HERO_ARTWORK_COLLECTIONS[id];
}

export function listCollections(): HeroArtworkCollection[] {
  return Object.values(HERO_ARTWORK_COLLECTIONS);
}

export function primaryCollection(
  collections: HeroArtworkCollectionId[]
): HeroArtworkCollectionId | null {
  return collections[0] ?? null;
}

export function collectionMatchesSeason(
  collectionId: HeroArtworkCollectionId,
  season: HeroArtworkSeason
): boolean {
  const collection = HERO_ARTWORK_COLLECTIONS[collectionId];
  return (
    collection.seasonalAffinity.length === 0 ||
    collection.seasonalAffinity.includes(season)
  );
}

export function collectionMatchesHoliday(
  collectionId: HeroArtworkCollectionId,
  holiday: HeroArtworkHoliday
): boolean {
  const collection = HERO_ARTWORK_COLLECTIONS[collectionId];
  return collection.holidayAffinity.includes(holiday);
}
