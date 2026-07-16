import type { HeroArtworkAsset, MorningHeroExperience } from "./types";
import { formatHeroArtworkCredit } from "./licensing";
import { validateAboutArtworkBody } from "./editorial";
import { normalizeMorningHeroExperience } from "./normalize";

/** Client-side mirror — copies a local asset into the edition hero shape. */
export function buildMorningHeroExperience(
  asset: HeroArtworkAsset,
  editionDate: string
): MorningHeroExperience | null {
  const about = validateAboutArtworkBody(asset.aboutArtworkBody);
  if (!about.valid || !asset.aboutArtworkBody?.trim()) return null;

  const uri = asset.imageSource?.uri?.trim();
  if (!uri) return null;

  return normalizeMorningHeroExperience({
    editionDate,
    artworkId: asset.id,
    artworkTitle: asset.artworkTitle,
    artist: asset.artist,
    year: asset.year,
    sourceInstitution: asset.sourceInstitution,
    sourceUrl: asset.sourceUrl,
    license: asset.license,
    licenseUrl: asset.licenseUrl,
    hostedUrl: uri,
    imageUrl: uri,
    creditLine: formatHeroArtworkCredit(asset),
    aboutArtworkBody: asset.aboutArtworkBody.trim(),
    aboutWordCount: about.wordCount,
    collections: asset.collections,
  });
}
