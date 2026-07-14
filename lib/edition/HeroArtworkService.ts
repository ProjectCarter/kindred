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
  MorningHeroExperience,
  HeroArtworkCollectionId,
} from "./heroArtwork/types";

export {
  HERO_ARTWORK_COLLECTION_IDS,
  primaryCollection,
  type HeroArtworkCollection,
} from "./heroArtwork/collections";

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
  validateAboutArtworkBody,
  ABOUT_ARTWORK_WORD_MIN,
  ABOUT_ARTWORK_WORD_MAX,
} from "./heroArtwork/editorial";

export { selectBanditMorningNote } from "./heroArtwork/banditNote";

export { buildMorningHeroExperience } from "./heroArtwork/presentation";

export {
  loadRecentHeroArtworkIds,
  rememberHeroArtworkShown,
} from "./heroArtwork/rotation";

export {
  getFrozenHeroArtworkId,
  getFrozenMorningHeroExperience,
  setFrozenMorningHeroExperience,
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
  getFrozenMorningHeroExperience,
  setFrozenMorningHeroExperience,
  setFrozenHeroArtworkId,
  clearFrozenHeroArtwork,
} from "./heroArtwork/freeze";
import { buildMorningHeroExperience } from "./heroArtwork/presentation";

export const HeroArtworkService = {
  getCatalog: getHeroArtworkCatalog,
  registerAssets: registerHeroArtworkAssets,
  getAssetById: getHeroArtworkAssetById,
  selectHeroArtwork,
  scoreCatalog: scoreHeroArtworkCatalog,
  parseEditionDate,
  getSeason,
  buildMorningExperience: buildMorningHeroExperience,
  loadRecentHeroArtworkIds,
  rememberHeroArtworkShown,
  getFrozenHeroArtworkId,
  getFrozenMorningExperience: getFrozenMorningHeroExperience,
  setFrozenMorningExperience: setFrozenMorningHeroExperience,
  setFrozenHeroArtworkId,
  clearFrozenHeroArtwork,
};

export default HeroArtworkService;
