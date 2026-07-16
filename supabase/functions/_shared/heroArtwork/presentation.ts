import type { HeroArtworkCollectionId } from "./collections.ts";
import { countWords, validateAboutArtworkBody } from "./editorial.ts";
import {
  isMasterpieceDetailComplete,
  splitStoryParagraphs,
  type MasterpieceDetailFields,
} from "./detailEditorial.ts";
import type { HeroArtworkRecord } from "./types.ts";

/** Full detail article — frozen at ingest, rendered only when the reader taps. */
export type MasterpieceDetail = {
  longStoryBody: string;
  longStoryParagraphs: string[];
  artistBiography: string;
  lookCloserItems: string[];
  didYouKnow: string;
  museumName: string;
  museumLocation: string;
  officialMuseumUrl: string | null;
  officialArtworkUrl: string | null;
  sourceReferences: string[];
};

/**
 * Frozen morning hero teaser — homepage fields only.
 * Edition build must never generate, research, or validate hero content.
 */
export type MorningHeroExperience = {
  editionDate: string;
  artworkId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string | null;
  /** Mobile-optimized hosted asset only — never museum full resolution. */
  hostedUrl: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
  /** Full credit line — pre-authored at ingest. */
  creditLine: string;
  /** 2–4 sentence homepage summary — pre-authored at ingest. */
  aboutArtworkBody: string;
  aboutWordCount: number;
  collections: HeroArtworkCollectionId[];
  /** Full detail article — omitted from homepage render path. */
  detail?: MasterpieceDetail | null;
};

export function detailFromRecord(
  artwork: HeroArtworkRecord
): MasterpieceDetail | null {
  const fields: MasterpieceDetailFields = {
    longStoryBody: artwork.longStoryBody,
    artistBiography: artwork.artistBiography,
    lookCloserItems: artwork.lookCloserItems,
    didYouKnow: artwork.didYouKnow,
    museumName: artwork.museumName,
    museumLocation: artwork.museumLocation,
    officialMuseumUrl: artwork.officialMuseumUrl,
    officialArtworkUrl: artwork.officialArtworkUrl,
    sourceReferences: artwork.sourceReferences,
    detailEditorialStatus: artwork.detailEditorialStatus,
  };

  if (!isMasterpieceDetailComplete(fields)) return null;

  const paragraphs = splitStoryParagraphs(artwork.longStoryBody!);
  return {
    longStoryBody: artwork.longStoryBody!.trim(),
    longStoryParagraphs: paragraphs,
    artistBiography: artwork.artistBiography!.trim(),
    lookCloserItems: artwork.lookCloserItems.map((item) => item.trim()),
    didYouKnow: artwork.didYouKnow!.trim(),
    museumName: artwork.museumName!.trim(),
    museumLocation: artwork.museumLocation!.trim(),
    officialMuseumUrl: artwork.officialMuseumUrl?.trim() || null,
    officialArtworkUrl: artwork.officialArtworkUrl?.trim() || null,
    sourceReferences: (artwork.sourceReferences ?? []).map((ref) => ref.trim()),
  };
}

export function isCompleteLibraryRecord(
  artwork: HeroArtworkRecord
): boolean {
  if (!artwork.hostedUrl?.trim() || !artwork.storagePath?.trim()) return false;
  if (!artwork.imageWidth || !artwork.imageHeight || !artwork.aspectRatio) {
    return false;
  }
  if (!artwork.artworkTitle?.trim() || !artwork.artist?.trim()) return false;
  if (!artwork.sourceInstitution?.trim() || !artwork.sourceUrl?.trim()) {
    return false;
  }
  if (!artwork.license?.trim() || !artwork.attributionText?.trim()) {
    return false;
  }
  const about = validateAboutArtworkBody(artwork.aboutArtworkBody);
  if (!about.valid) return false;

  return detailFromRecord(artwork) != null;
}

/** Copy existing library fields into the frozen edition payload — no side effects. */
export function copyMorningHeroFromRecord(
  artwork: HeroArtworkRecord,
  editionDate: string
): MorningHeroExperience | null {
  if (!isCompleteLibraryRecord(artwork)) return null;

  const about = validateAboutArtworkBody(artwork.aboutArtworkBody);
  const detail = detailFromRecord(artwork);
  if (!about.valid || !artwork.aboutArtworkBody?.trim() || !detail) return null;

  return {
    editionDate,
    artworkId: artwork.id,
    artworkTitle: artwork.artworkTitle.trim(),
    artist: artwork.artist.trim(),
    year: artwork.year,
    sourceInstitution: artwork.sourceInstitution.trim(),
    sourceUrl: artwork.sourceUrl.trim(),
    license: artwork.license,
    licenseUrl: artwork.licenseUrl,
    hostedUrl: artwork.hostedUrl!.trim(),
    imageUrl: artwork.hostedUrl!.trim(),
    imageWidth: artwork.imageWidth!,
    imageHeight: artwork.imageHeight!,
    aspectRatio: artwork.aspectRatio!,
    creditLine: artwork.attributionText!.trim(),
    aboutArtworkBody: artwork.aboutArtworkBody.trim(),
    aboutWordCount: about.wordCount,
    collections: artwork.collections,
    detail,
  };
}

/** @deprecated Use copyMorningHeroFromRecord — kept for tests importing the old name. */
export const buildMorningHeroExperience = copyMorningHeroFromRecord;
