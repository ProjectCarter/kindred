import type { HeroImageAsset, HeroRegionId } from "./types";

/**
 * Curated starter library.
 * Every asset carries full geographic + seasonal metadata so the
 * scoring engine can stay stable as hundreds of photos are added.
 *
 * IMPORTANT: city/metro fields are only set for true place photographs.
 * Never tag a generic skyline as a specific city.
 */
export const HERO_CATALOG: HeroImageAsset[] = [
  {
    id: "spring-flowers",
    title: "Spring blossoms",
    source: require("../../../assets/heroes/hero-spring-flowers.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["spring"],
    month: [3, 4, 5],
    weatherTags: ["clear", "cloudy"],
    holidayTags: ["easter", "st_patricks"],
    imageType: "seasonal",
    priority: 55,
  },
  {
    id: "summer-sunrise",
    title: "Summer sunrise",
    source: require("../../../assets/heroes/hero-summer-sunrise.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["summer"],
    month: [6, 7, 8],
    weatherTags: ["clear", "hot"],
    holidayTags: ["independence_day", "labor_day", "memorial_day"],
    imageType: "seasonal",
    priority: 55,
  },
  {
    id: "autumn-leaves",
    title: "Autumn leaves",
    source: require("../../../assets/heroes/hero-autumn-leaves.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["autumn"],
    month: [9, 10, 11],
    weatherTags: ["clear", "cloudy", "cold"],
    holidayTags: ["halloween", "thanksgiving"],
    imageType: "seasonal",
    priority: 55,
  },
  {
    id: "winter-snowfall",
    title: "Winter snowfall",
    source: require("../../../assets/heroes/hero-winter-snowfall.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["winter"],
    month: [12, 1, 2],
    weatherTags: ["snow", "cold", "cloudy"],
    holidayTags: ["christmas", "new_year", "new_years_eve"],
    imageType: "seasonal",
    priority: 60,
  },
  {
    id: "beach-morning",
    title: "Beach morning",
    source: require("../../../assets/heroes/hero-beach-morning.jpg"),
    city: null,
    metro: null,
    region: "southern_california",
    state: null,
    country: "US",
    season: ["spring", "summer", "autumn"],
    month: [3, 4, 5, 6, 7, 8, 9, 10],
    weatherTags: ["clear", "cloudy"],
    holidayTags: [],
    imageType: "regional",
    priority: 70,
  },
  {
    id: "beach-morning-gulf",
    title: "Quiet shore morning",
    source: require("../../../assets/heroes/hero-beach-morning.jpg"),
    city: null,
    metro: null,
    region: "gulf_coast",
    state: null,
    country: "US",
    season: ["spring", "summer", "autumn", "winter"],
    month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    weatherTags: ["clear", "cloudy"],
    holidayTags: [],
    imageType: "regional",
    priority: 68,
  },
  {
    id: "mountain-morning-rockies",
    title: "Mountain morning",
    source: require("../../../assets/heroes/hero-mountain-morning.jpg"),
    city: null,
    metro: null,
    region: "rocky_mountain",
    state: null,
    country: "US",
    season: ["spring", "summer", "autumn"],
    month: [4, 5, 6, 7, 8, 9, 10],
    weatherTags: ["clear", "cloudy"],
    holidayTags: [],
    imageType: "regional",
    priority: 72,
  },
  {
    id: "mountain-morning-pnw",
    title: "Northwest morning light",
    source: require("../../../assets/heroes/hero-mountain-morning.jpg"),
    city: null,
    metro: null,
    region: "pacific_northwest",
    state: null,
    country: "US",
    season: ["spring", "summer", "autumn"],
    month: [4, 5, 6, 7, 8, 9, 10],
    weatherTags: ["clear", "cloudy", "fog"],
    holidayTags: [],
    imageType: "regional",
    priority: 72,
  },
  {
    id: "desert-warm-morning",
    title: "Warm desert morning",
    source: require("../../../assets/heroes/hero-summer-sunrise.jpg"),
    city: null,
    metro: null,
    region: "southwest_desert",
    state: null,
    country: "US",
    season: ["spring", "summer", "autumn", "winter"],
    month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    weatherTags: ["clear", "hot", "cloudy"],
    holidayTags: [],
    imageType: "regional",
    priority: 74,
  },
  // Intentionally NOT tagged to any city — anonymous skyline only when
  // the reader's place is unknown. Never shown for a known city.
  {
    id: "city-sunrise-generic",
    title: "City morning light",
    source: require("../../../assets/heroes/hero-city-sunrise.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["spring", "summer", "autumn", "winter"],
    month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    weatherTags: ["clear", "cloudy"],
    holidayTags: [],
    imageType: "generic",
    priority: 20,
  },
  {
    id: "default-morning",
    title: "Quiet morning light",
    source: require("../../../assets/heroes/hero-default-morning.jpg"),
    city: null,
    metro: null,
    region: null,
    state: null,
    country: null,
    season: ["spring", "summer", "autumn", "winter"],
    month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    weatherTags: [],
    holidayTags: [],
    imageType: "generic",
    priority: 5,
  },
];

/** Mutable registry — append remote/AI assets without rewriting the selector. */
let runtimeCatalog: HeroImageAsset[] = [...HERO_CATALOG];

export function getHeroCatalog(): HeroImageAsset[] {
  return runtimeCatalog;
}

export function registerHeroImages(assets: HeroImageAsset[]): void {
  const byId = new Map(runtimeCatalog.map((a) => [a.id, a]));
  for (const asset of assets) {
    byId.set(asset.id, asset);
  }
  runtimeCatalog = Array.from(byId.values());
}

export function resetHeroCatalog(): void {
  runtimeCatalog = [...HERO_CATALOG];
}

/**
 * Planned city library slots (documentation for future photography).
 * Wire real assets via registerHeroImages() — do not invent landmarks.
 */
export const PLANNED_CITY_LIBRARY: Record<
  string,
  { region: HeroRegionId; subjects: string[] }
> = {
  Seattle: {
    region: "pacific_northwest",
    subjects: [
      "Mt. Rainier",
      "Pike Place",
      "Puget Sound sunrise",
      "Discovery Park",
      "Ferry at dawn",
    ],
  },
  Phoenix: {
    region: "southwest_desert",
    subjects: [
      "Desert sunrise",
      "Camelback Mountain",
      "Saguaro cactus",
      "Monsoon clouds",
      "Downtown skyline",
    ],
  },
  "San Diego": {
    region: "southern_california",
    subjects: ["Beach sunrise", "La Jolla", "Balboa Park", "Harbor", "Cliffs"],
  },
  Denver: {
    region: "rocky_mountain",
    subjects: [
      "Rocky Mountains",
      "Union Station",
      "Fall aspens",
      "Snow after sunrise",
    ],
  },
};
