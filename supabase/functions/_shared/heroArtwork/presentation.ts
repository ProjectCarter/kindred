import type { HeroArtworkCollectionId } from "./collections.ts";
import { buildAttributionText } from "./licensing.ts";
import { selectBanditMorningNote, type BanditNoteContext } from "./banditNote.ts";
import { validateAboutArtworkBody } from "./editorial.ts";
import type { HeroArtworkRecord } from "./types.ts";

/**
 * The complete morning hero experience — artwork, editorial context, Bandit's welcome.
 * Frozen per edition date; refresh must never change this payload.
 */
export type MorningHeroExperience = {
  editionDate: string;
  artworkId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  imageUrl: string | null;
  hostedUrl: string | null;
  attributionText: string;
  collections: HeroArtworkCollectionId[];
  aboutArtworkHeading: "About Today's Artwork";
  aboutArtworkBody: string;
  aboutWordCount: number;
  banditMorningNote: string;
};

export function buildMorningHeroExperience(
  artwork: HeroArtworkRecord,
  editionDate: string,
  banditContext: BanditNoteContext = {}
): MorningHeroExperience | null {
  const about = validateAboutArtworkBody(artwork.aboutArtworkBody);
  if (!about.valid || !artwork.aboutArtworkBody?.trim()) {
    return null;
  }

  const attribution =
    artwork.attributionText?.trim() ??
    buildAttributionText({
      artworkTitle: artwork.artworkTitle,
      artist: artwork.artist,
      year: artwork.year,
      sourceInstitution: artwork.sourceInstitution,
      sourceUrl: artwork.sourceUrl,
    });

  return {
    editionDate,
    artworkId: artwork.id,
    artworkTitle: artwork.artworkTitle,
    artist: artwork.artist,
    year: artwork.year,
    sourceInstitution: artwork.sourceInstitution,
    sourceUrl: artwork.sourceUrl,
    imageUrl: artwork.imageUrl,
    hostedUrl: artwork.hostedUrl,
    attributionText: attribution,
    collections: artwork.collections,
    aboutArtworkHeading: "About Today's Artwork",
    aboutArtworkBody: artwork.aboutArtworkBody.trim(),
    aboutWordCount: about.wordCount,
    banditMorningNote: selectBanditMorningNote(artwork, {
      ...banditContext,
      editionDate,
    }),
  };
}

export function presentationFromSnapshot(
  snapshot: MorningHeroExperience
): MorningHeroExperience {
  return snapshot;
}
