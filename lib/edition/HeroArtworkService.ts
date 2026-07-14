/**
 * Kindred Hero Artwork — public API for the morning masthead artwork desk.
 * Completely separate from HeroImageService (legacy photography) and the
 * editorial photography pipeline (resolveItemImage / kindred_image_library).
 */

export type {
  HeroArtworkOrientation,
  HeroArtworkSeason,
  HeroArtworkHoliday,
  HeroArtworkSourceProvider,
  HeroArtworkLicense,
  HeroArtworkAsset,
  HeroArtworkContext,
  ScoredHeroArtwork,
} from "./heroArtwork/types";

export {
  INITIAL_HERO_ARTWORK_PLAN_COUNT,
  type PlannedHeroArtwork,
} from "./heroArtwork/initialLibraryPlan";

export {
  getHeroArtworkCatalog,
  registerHeroArtworkAssets,
  resetHeroArtworkCatalog,
  getHeroArtworkAssetById,
} from "./heroArtwork/catalog";

export {
  selectHeroArtwork,
  scoreHeroArtworkCatalog,
  parseEditionDate,
  getSeason,
} from "./heroArtwork/selectHeroArtwork";

export {
  isHeroArtworkAssetSelectable,
  formatHeroArtworkCredit,
} from "./heroArtwork/licensing";

export {
  loadRecentHeroArtworkIds,
  rememberHeroArtworkShown,
} from "./heroArtwork/rotation";

export {
  getFrozenHeroArtworkId,
  setFrozenHeroArtworkId,
  clearFrozenHeroArtwork,
} from "./heroArtwork/freeze";

import {
  getHeroArtworkCatalog,
  registerHeroArtworkAssets,
  getHeroArtworkAssetById,
} from "./heroArtwork/catalog";
import {
  selectHeroArtwork,
  scoreHeroArtworkCatalog,
  parseEditionDate,
  getSeason,
} from "./heroArtwork/selectHeroArtwork";
import {
  loadRecentHeroArtworkIds,
  rememberHeroArtworkShown,
} from "./heroArtwork/rotation";
import {
  getFrozenHeroArtworkId,
  setFrozenHeroArtworkId,
  clearFrozenHeroArtwork,
} from "./heroArtwork/freeze";

export const HeroArtworkService = {
  getCatalog: getHeroArtworkCatalog,
  registerAssets: registerHeroArtworkAssets,
  getAssetById: getHeroArtworkAssetById,
  selectHeroArtwork,
  scoreCatalog: scoreHeroArtworkCatalog,
  parseEditionDate,
  getSeason,
  loadRecentHeroArtworkIds,
  rememberHeroArtworkShown,
  getFrozenHeroArtworkId,
  setFrozenHeroArtworkId,
  clearFrozenHeroArtwork,
};

export default HeroArtworkService;
