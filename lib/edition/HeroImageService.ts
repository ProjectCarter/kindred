/**
 * Kindred morning hero photography — public API.
 * Selection stays stable as the catalog grows to hundreds or thousands of images.
 */

export type {
  Season,
  WeatherTag,
  HolidayTag,
  HeroImageType,
  HeroRegionId,
  ResolvedLocation,
  HeroImageAsset,
  HeroImageContext,
  ScoredHeroImage,
} from "./hero/types";

export {
  HERO_CATALOG,
  PLANNED_CITY_LIBRARY,
  getHeroCatalog,
  registerHeroImages,
  resetHeroCatalog,
} from "./hero/catalog";

export { CITY_DIRECTORY, resolveLocation, placesMatch } from "./hero/location";

export { detectHoliday } from "./hero/holidays";

export {
  selectHeroImage,
  scoreHeroCatalog,
  isEligible,
  parseEditionDate,
  getSeason,
  inferWeatherTag,
} from "./hero/selectHeroImage";

export {
  loadRecentHeroImageIds,
  rememberHeroImageShown,
} from "./hero/rotation";

import { HERO_CATALOG, getHeroCatalog, registerHeroImages } from "./hero/catalog";
import { selectHeroImage, getSeason, parseEditionDate, inferWeatherTag } from "./hero/selectHeroImage";
import { detectHoliday } from "./hero/holidays";
import { resolveLocation } from "./hero/location";
import {
  loadRecentHeroImageIds,
  rememberHeroImageShown,
} from "./hero/rotation";

export const HeroImageService = {
  catalog: HERO_CATALOG,
  getCatalog: getHeroCatalog,
  registerImages: registerHeroImages,
  selectHeroImage,
  getSeason,
  detectHoliday,
  inferWeatherTag,
  resolveLocation,
  parseEditionDate,
  loadRecentHeroImageIds,
  rememberHeroImageShown,
};

export default HeroImageService;
