import type { HeroArtworkCollectionId } from "./collections.ts";
import { hasLibraryAboutArtworkBody, validateAboutArtworkBody } from "./editorial.ts";
import { isApprovedMasterpieceLibraryRecord } from "./libraryValidation.ts";
import {
  isMasterpieceDetailComplete,
  splitStoryParagraphs,
  type MasterpieceDetailFields,
} from "./detailEditorial.ts";
import {
  isFrozenDetailComplete,
  synthesizeMasterpieceDetail,
} from "./detailTemplate.ts";
import { resolveArtworkYear } from "./resolveYear.ts";
import { buildValidatedMasterpieceDetail } from "./articleDetail.ts";
import { masterpieceDetailIsCorrupt } from "./articleValidation.ts";
import type { HeroArtworkRecord } from "./types.ts";

export type MasterpieceEditorialSections = {
  introduction: string;
  aboutTheArtist: string;
  storyBehindArtwork: string;
  historicalContext: string;
  legacy: string;
  /** @deprecated Use editorialReflection — kept for stored JSON compatibility. */
  editorialClosing: string;
  editorialReflection?: string;
};

export type MasterpieceArticleSection = {
  heading: string;
  paragraphs: string[];
};

export type MasterpieceDetail = {
  sections: MasterpieceArticleSection[];
  lookingCloser: string[];
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
  hostedUrl: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
  creditLine: string;
  aboutArtworkBody: string;
  aboutWordCount: number;
  collections: HeroArtworkCollectionId[];
  detail?: MasterpieceDetail | null;
};

function paragraphsFromText(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function sectionsFromEditorial(
  editorial: MasterpieceEditorialSections | null | undefined,
  artistBiography: string | null
): MasterpieceArticleSection[] {
  if (!editorial) return [];

  const aboutArtist =
    editorial.aboutTheArtist?.trim() || artistBiography?.trim() || "";

  return [
    {
      heading: "Introduction",
      paragraphs: paragraphsFromText(editorial.introduction),
    },
    {
      heading: "About the Artist",
      paragraphs: paragraphsFromText(aboutArtist),
    },
    {
      heading: "The Story Behind the Artwork",
      paragraphs: paragraphsFromText(editorial.storyBehindArtwork),
    },
    {
      heading: "Historical Context",
      paragraphs: paragraphsFromText(editorial.historicalContext),
    },
    {
      heading: "Legacy",
      paragraphs: paragraphsFromText(editorial.legacy),
    },
    {
      heading: "Editorial Reflection",
      paragraphs: paragraphsFromText(
        editorial.editorialReflection?.trim() ||
          editorial.editorialClosing?.trim() ||
          ""
      ),
    },
  ].filter((section) => section.paragraphs.length > 0);
}

function legacySectionsFromBody(
  longStoryBody: string,
  artistBiography: string | null
): MasterpieceArticleSection[] {
  const paragraphs = splitStoryParagraphs(longStoryBody);
  const sections: MasterpieceArticleSection[] = [
    { heading: "Introduction", paragraphs: paragraphs.slice(0, 1) },
  ];

  if (artistBiography?.trim()) {
    sections.push({
      heading: "About the Artist",
      paragraphs: [artistBiography.trim()],
    });
  }

  sections.push(
    {
      heading: "The Story Behind the Artwork",
      paragraphs: paragraphs.slice(1, 3),
    },
    {
      heading: "Historical Context",
      paragraphs: paragraphs.slice(3, 4),
    },
    { heading: "Legacy", paragraphs: paragraphs.slice(4, 5) },
    { heading: "Editorial Reflection", paragraphs: paragraphs.slice(5) }
  );

  return sections.filter((section) => section.paragraphs.length > 0);
}

export function detailFromApprovedRecord(
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

  const structured = sectionsFromEditorial(
    artwork.editorialSections,
    artwork.artistBiography
  );
  const sections =
    structured.length > 0
      ? structured
      : legacySectionsFromBody(
          artwork.longStoryBody!,
          artwork.artistBiography
        );

  if (sections.length === 0) return null;

  const detail: MasterpieceDetail = {
    sections,
    lookingCloser: artwork.lookCloserItems.map((item) => item.trim()),
    didYouKnow: artwork.didYouKnow!.trim(),
    museumName: artwork.museumName!.trim(),
    museumLocation: artwork.museumLocation!.trim(),
    officialMuseumUrl: artwork.officialMuseumUrl?.trim() || null,
    officialArtworkUrl: artwork.officialArtworkUrl?.trim() || null,
    sourceReferences: (artwork.sourceReferences ?? []).map((ref) => ref.trim()),
  };

  if (!isFrozenDetailComplete(detail) || masterpieceDetailIsCorrupt(detail)) {
    return null;
  }

  return detail;
}

/** Ingest / backfill only — may synthesize thin rows. Never call at edition build. */
export function detailFromRecord(
  artwork: HeroArtworkRecord
): MasterpieceDetail | null {
  const approved = detailFromApprovedRecord(artwork);
  if (approved) return approved;

  if (!hasLibraryAboutArtworkBody(artwork.aboutArtworkBody)) return null;

  const detail = buildValidatedMasterpieceDetail({
    artworkTitle: artwork.artworkTitle,
    artist: artwork.artist,
    year: artwork.year,
    sourceInstitution: artwork.sourceInstitution,
    sourceUrl: artwork.sourceUrl,
    aboutArtworkBody: artwork.aboutArtworkBody ?? "",
    collections: artwork.collections,
  });

  if (!isFrozenDetailComplete(detail) || masterpieceDetailIsCorrupt(detail)) {
    return synthesizeMasterpieceDetail({
      artworkTitle: artwork.artworkTitle,
      artist: artwork.artist,
      year: artwork.year,
      sourceInstitution: artwork.sourceInstitution,
      sourceUrl: artwork.sourceUrl,
      aboutArtworkBody: artwork.aboutArtworkBody ?? "",
      collections: artwork.collections,
    });
  }

  return detail;
}

export function isMorningHeroDetailComplete(
  detail: MasterpieceDetail | null | undefined
): boolean {
  return isFrozenDetailComplete(detail);
}

function defaultHeroDimensions(artwork: HeroArtworkRecord): {
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
} {
  const imageWidth = artwork.imageWidth ?? 1400;
  const aspectRatio = artwork.aspectRatio ?? 1.5;
  const imageHeight =
    artwork.imageHeight ?? Math.round(imageWidth / aspectRatio);
  return { imageWidth, imageHeight, aspectRatio };
}

export function isCompleteLibraryRecord(
  artwork: HeroArtworkRecord
): boolean {
  return (
    isApprovedMasterpieceLibraryRecord(artwork) &&
    detailFromApprovedRecord(artwork) != null
  );
}

export function copyMorningHeroFromRecord(
  artwork: HeroArtworkRecord,
  editionDate: string
): MorningHeroExperience | null {
  if (!isCompleteLibraryRecord(artwork)) return null;

  const body = artwork.aboutArtworkBody?.trim() ?? "";
  if (!hasLibraryAboutArtworkBody(body)) return null;
  const detail = detailFromApprovedRecord(artwork);
  if (!detail) return null;

  const dims = defaultHeroDimensions(artwork);
  const aboutWordCount = body.split(/\s+/).filter(Boolean).length;

  return {
    editionDate,
    artworkId: artwork.id,
    artworkTitle: artwork.artworkTitle.trim(),
    artist: artwork.artist.trim(),
    year: resolveArtworkYear({
      year: artwork.year,
      artworkTitle: artwork.artworkTitle,
      sourceUrl: artwork.sourceUrl,
      tags: artwork.tags,
      aboutArtworkBody: artwork.aboutArtworkBody,
    }),
    sourceInstitution: artwork.sourceInstitution.trim(),
    sourceUrl: artwork.sourceUrl.trim(),
    license: artwork.license,
    licenseUrl: artwork.licenseUrl,
    hostedUrl: artwork.hostedUrl!.trim(),
    imageUrl: artwork.hostedUrl!.trim(),
    imageWidth: dims.imageWidth,
    imageHeight: dims.imageHeight,
    aspectRatio: dims.aspectRatio,
    creditLine: artwork.attributionText!.trim(),
    aboutArtworkBody: body,
    aboutWordCount,
    collections: artwork.collections,
    detail,
  };
}

/** @deprecated Use copyMorningHeroFromRecord — kept for tests importing the old name. */
export const buildMorningHeroExperience = copyMorningHeroFromRecord;
