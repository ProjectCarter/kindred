import type { HeroArtworkRecord } from "./types.ts";
import type { MorningHeroExperience } from "./presentation.ts";
import { synthesizeMasterpieceDetail } from "./detailTemplate.ts";
import type { MasterpieceTemplateInput } from "./detailTemplate.ts";
import {
  assertCleanEditorialField,
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeArtworkYear,
  sanitizeEditorialText,
  sanitizeStringList,
} from "./sanitizeMetadata.ts";
import {
  masterpieceDetailIsCorrupt,
  morningHeroArticleIsCorrupt,
  validateMorningHeroArticle,
} from "./articleValidation.ts";
import { buildValidatedMasterpieceDetail } from "./articleDetail.ts";

function templateInputFromHero(
  hero: Pick<
    MorningHeroExperience,
    | "artworkTitle"
    | "artist"
    | "year"
    | "sourceInstitution"
    | "sourceUrl"
    | "aboutArtworkBody"
    | "collections"
  >
): MasterpieceTemplateInput {
  return {
    artworkTitle: hero.artworkTitle,
    artist: hero.artist,
    year: hero.year,
    sourceInstitution: hero.sourceInstitution?.trim() ?? "",
    sourceUrl: hero.sourceUrl?.trim() ?? "",
    aboutArtworkBody: hero.aboutArtworkBody,
    collections: hero.collections,
  };
}

/** Sanitize persisted library record fields after DB read. */
export function sanitizeHeroArtworkRecord(
  record: HeroArtworkRecord
): HeroArtworkRecord {
  const fileHint = record.sourceUrl?.includes("commons.wikimedia.org")
    ? record.sourceUrl.split("/wiki/").pop()?.replace(/_/g, " ")
    : null;

  const artworkTitle = assertCleanEditorialField(
    "artworkTitle",
    record.artworkTitle,
    (v) =>
      sanitizeArtworkTitle(v, {
        filePageTitle: fileHint ? `File:${fileHint}` : null,
      })
  );
  const artist = assertCleanEditorialField("artist", record.artist, (v) =>
    sanitizeArtistName(v, fileHint ? `File:${fileHint}` : null)
  );
  const year = sanitizeArtworkYear(record.year, {
    title: record.artworkTitle,
    imageDescription: record.aboutArtworkBody,
    filePageTitle: fileHint ? `File:${fileHint}` : null,
  });

  return {
    ...record,
    artworkTitle,
    artist,
    year,
    aboutArtworkBody: assertCleanEditorialField(
      "aboutArtworkBody",
      record.aboutArtworkBody
    ),
    attributionText: assertCleanEditorialField(
      "attributionText",
      record.attributionText
    ),
    artistBiography: record.artistBiography
      ? assertCleanEditorialField("artistBiography", record.artistBiography)
      : record.artistBiography,
    didYouKnow: record.didYouKnow
      ? assertCleanEditorialField("didYouKnow", record.didYouKnow)
      : record.didYouKnow,
    museumName: record.museumName
      ? assertCleanEditorialField("museumName", record.museumName)
      : record.museumName,
    museumLocation: record.museumLocation
      ? assertCleanEditorialField("museumLocation", record.museumLocation)
      : record.museumLocation,
    tags: sanitizeStringList(record.tags),
    longStoryBody: record.longStoryBody
      ? assertCleanEditorialField("longStoryBody", record.longStoryBody)
      : record.longStoryBody,
  };
}

export function morningHeroMetadataNeedsRepair(
  before: MorningHeroExperience,
  after: MorningHeroExperience
): boolean {
  return (
    before.artworkTitle !== after.artworkTitle ||
    before.artist !== after.artist ||
    before.year !== after.year ||
    before.aboutArtworkBody !== after.aboutArtworkBody ||
    before.creditLine !== after.creditLine ||
    morningHeroArticleIsCorrupt(before)
  );
}

/** Sanitize frozen morning hero — always regenerates detail when article validation fails. */
export function sanitizeMorningHeroExperience(
  hero: MorningHeroExperience
): MorningHeroExperience {
  const fileHint = hero.sourceUrl?.includes("commons.wikimedia.org")
    ? hero.sourceUrl.split("/wiki/").pop()?.replace(/_/g, " ")
    : null;

  const artworkTitle = sanitizeArtworkTitle(hero.artworkTitle, {
    filePageTitle: fileHint ? `File:${fileHint}` : null,
  });
  const artist = sanitizeArtistName(
    hero.artist,
    fileHint ? `File:${fileHint}` : null
  );
  const year = sanitizeArtworkYear(hero.year, {
    title: hero.artworkTitle,
    imageDescription: hero.aboutArtworkBody,
    filePageTitle: fileHint ? `File:${fileHint}` : null,
  });
  const aboutArtworkBody = sanitizeEditorialText(hero.aboutArtworkBody);
  const creditLine = sanitizeEditorialText(hero.creditLine);

  const templateInput = templateInputFromHero({
    ...hero,
    artworkTitle,
    artist,
    year,
    aboutArtworkBody,
  });

  let detail = hero.detail;
  if (morningHeroArticleIsCorrupt({ ...hero, artworkTitle, artist, aboutArtworkBody, creditLine, detail })) {
    detail =
      buildValidatedMasterpieceDetail(templateInput) ??
      synthesizeMasterpieceDetail(templateInput);
  }

  const cleaned: MorningHeroExperience = {
    ...hero,
    artworkTitle,
    artist,
    year,
    aboutArtworkBody,
    creditLine,
    detail,
    aboutWordCount: aboutArtworkBody.split(/\s+/).filter(Boolean).length,
  };

  if (!validateMorningHeroArticle(cleaned)) {
    console.warn("[heroArtwork] morning hero still corrupt after regeneration", {
      artworkId: hero.artworkId,
      editionDate: hero.editionDate,
    });
    cleaned.detail = synthesizeMasterpieceDetail(templateInput);
  }

  return cleaned;
}
