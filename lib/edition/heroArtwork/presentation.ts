import type { HeroArtworkAsset, MorningHeroExperience } from "./types";
import { formatHeroArtworkCredit } from "./licensing";
import { validateAboutArtworkBody } from "./editorial";
import { selectBanditMorningNote } from "./banditNote";

export function buildMorningHeroExperience(
  asset: HeroArtworkAsset,
  editionDate: string
): MorningHeroExperience | null {
  const about = validateAboutArtworkBody(asset.aboutArtworkBody);
  if (!about.valid || !asset.aboutArtworkBody?.trim()) return null;

  const uri = asset.imageSource?.uri ?? null;

  return {
    editionDate,
    artworkId: asset.id,
    artworkTitle: asset.artworkTitle,
    artist: asset.artist,
    year: asset.year,
    sourceInstitution: asset.sourceInstitution,
    sourceUrl: asset.sourceUrl,
    imageUrl: uri,
    hostedUrl: uri,
    attributionText: formatHeroArtworkCredit(asset),
    collections: asset.collections,
    aboutArtworkHeading: "About Today's Artwork",
    aboutArtworkBody: asset.aboutArtworkBody.trim(),
    aboutWordCount: about.wordCount,
    banditMorningNote: selectBanditMorningNote(asset, { editionDate }),
  };
}
