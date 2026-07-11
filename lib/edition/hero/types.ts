import type { ImageSourcePropType } from "react-native";

export type Season = "spring" | "summer" | "autumn" | "winter";

export type WeatherTag =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "storm"
  | "hot"
  | "cold";

export type HolidayTag =
  | "new_year"
  | "valentines"
  | "st_patricks"
  | "easter"
  | "memorial_day"
  | "independence_day"
  | "labor_day"
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "new_years_eve"
  | "birthday";

/**
 * How specific the photograph is.
 * city/metro images must never show for the wrong place.
 */
export type HeroImageType =
  | "city"
  | "metro"
  | "regional"
  | "seasonal"
  | "holiday"
  | "generic";

export type HeroRegionId =
  | "pacific_northwest"
  | "southwest_desert"
  | "southern_california"
  | "rocky_mountain"
  | "midwest"
  | "northeast"
  | "southeast"
  | "gulf_coast"
  | "hawaii"
  | "generic";

export type ResolvedLocation = {
  city: string | null;
  metro: string | null;
  region: HeroRegionId | null;
  state: string | null;
  country: string | null;
};

export type HeroImageAsset = {
  id: string;
  title: string;
  /** Local require() or remote { uri } — catalog stays source-agnostic for growth. */
  source: ImageSourcePropType;
  city: string | null;
  metro: string | null;
  region: HeroRegionId | null;
  state: string | null;
  country: string | null;
  season: Season[];
  month: number[];
  weatherTags: WeatherTag[];
  holidayTags: HolidayTag[];
  imageType: HeroImageType;
  /** 0–100 soft preference within the same geographic tier. */
  priority: number;
};

export type HeroImageContext = {
  date?: Date | string | null;
  weatherText?: string | null;
  weather?: WeatherTag | null;
  /** Reader birthday MM-DD for special edition (optional). */
  birthdayMMDD?: string | null;
  /** Recently shown image ids — used to rotate the library. */
  recentImageIds?: string[] | null;
  location?: {
    city?: string | null;
    metro?: string | null;
    region?: HeroRegionId | null;
    state?: string | null;
    country?: string | null;
    lat?: number | null;
    lon?: number | null;
  } | null;
};

export type ScoredHeroImage = {
  asset: HeroImageAsset;
  score: number;
  reasons: string[];
};
