import type {
  MasterpieceArticleSection,
  MorningHeroExperience,
  MasterpieceDetail,
} from "./types";
import {
  isFrozenDetailComplete,
  synthesizeMasterpieceDetail,
} from "./detailTemplate";
import { resolveArtworkYear } from "./resolveYear";
import {
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeEditorialText,
} from "./sanitizeMetadata";
import { resolveCleanMasterpieceDetail } from "./articleDetail";
import { morningHeroArticleIsCorrupt } from "./articleValidation";
import { safeDecodeUriComponent } from "./safeDecodeUri";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "../masterpieceDiagnostics";

function parseSections(raw: unknown): MasterpieceArticleSection[] | null {
  if (!Array.isArray(raw)) return null;
  const sections = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const section = item as Partial<MasterpieceArticleSection>;
      const heading = section.heading?.trim();
      const paragraphs = (section.paragraphs ?? [])
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean);
      if (!heading || paragraphs.length === 0) return null;
      return { heading, paragraphs };
    })
    .filter(Boolean) as MasterpieceArticleSection[];
  return sections.length > 0 ? sections : null;
}

function parseMasterpieceDetail(raw: unknown): MasterpieceDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<MasterpieceDetail>;

  const sections = parseSections(d.sections);
  const lookingCloser = (d.lookingCloser ?? d.lookCloserItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  // Preserve structured detail even when some extended fields are missing.
  if (sections?.length) {
    return {
      sections,
      lookingCloser,
      didYouKnow: d.didYouKnow?.trim() ?? "",
      museumName: d.museumName?.trim() ?? "",
      museumLocation: d.museumLocation?.trim() ?? "",
      officialMuseumUrl: d.officialMuseumUrl?.trim() || null,
      officialArtworkUrl: d.officialArtworkUrl?.trim() || null,
      sourceReferences: (d.sourceReferences ?? [])
        .map((ref) => ref.trim())
        .filter(Boolean),
      longStoryBody: d.longStoryBody?.trim(),
      longStoryParagraphs: d.longStoryParagraphs,
      artistBiography: d.artistBiography?.trim(),
      lookCloserItems: lookingCloser,
    };
  }

  if (!d.longStoryBody?.trim()) return null;

  const paragraphs = d.longStoryBody
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    sections: [],
    lookingCloser,
    didYouKnow: d.didYouKnow?.trim() ?? "",
    museumName: d.museumName?.trim() ?? "",
    museumLocation: d.museumLocation?.trim() ?? "",
    officialMuseumUrl: d.officialMuseumUrl?.trim() || null,
    officialArtworkUrl: d.officialArtworkUrl?.trim() || null,
    sourceReferences: (d.sourceReferences ?? [])
      .map((ref) => ref.trim())
      .filter(Boolean),
    longStoryBody: d.longStoryBody.trim(),
    longStoryParagraphs: paragraphs,
    artistBiography: d.artistBiography?.trim(),
    lookCloserItems: lookingCloser,
  };
}

function commonsFilePageTitle(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.includes("commons.wikimedia.org")) return null;
  const fragment = sourceUrl.split("/wiki/").pop() ?? "";
  if (!fragment) return null;
  return `File:${safeDecodeUriComponent(fragment).replace(/_/g, " ")}`;
}

/** Normalize edition payload — supports legacy snapshots without dimensions. */
export function normalizeMorningHeroExperience(
  raw: Partial<MorningHeroExperience> & { attributionText?: string | null }
): MorningHeroExperience | null {
  masterpieceTraceBegin("normalize/sanitize", {
    artworkId: raw.artworkId ?? null,
  });
  const started = Date.now();

  try {
  const hostedUrl = raw.hostedUrl?.trim() || raw.imageUrl?.trim();
  const filePageTitle = commonsFilePageTitle(raw.sourceUrl);
  const artworkTitle = sanitizeArtworkTitle(raw.artworkTitle, {
    filePageTitle,
  });
  const artist = sanitizeArtistName(raw.artist, filePageTitle);
  const aboutArtworkBody = sanitizeEditorialText(raw.aboutArtworkBody);

  if (
    !raw.artworkId ||
    !artworkTitle ||
    !artist ||
    !aboutArtworkBody ||
    !hostedUrl
  ) {
    masterpieceTraceEnd("normalize/sanitize", {
      ms: Date.now() - started,
      result: "null",
      reason: "required_fields",
    });
    return null;
  }

  const imageWidth = raw.imageWidth ?? 1400;
  const imageHeight = raw.imageHeight ?? Math.round(1400 / (raw.aspectRatio ?? 1.5));
  const aspectRatio =
    raw.aspectRatio ?? Number((imageWidth / imageHeight).toFixed(6));

  let detail = parseMasterpieceDetail(raw.detail);
  const templateInput = {
    artworkTitle,
    artist,
    year: raw.year ?? null,
    sourceInstitution: raw.sourceInstitution?.trim() ?? "",
    sourceUrl: raw.sourceUrl?.trim() ?? "",
    aboutArtworkBody,
    collections: raw.collections ?? [],
  };

  if (
    !isFrozenDetailComplete(detail) ||
    morningHeroArticleIsCorrupt({
      artworkTitle,
      artist,
      aboutArtworkBody,
      creditLine: raw.creditLine ?? raw.attributionText ?? "",
      detail,
    })
  ) {
    detail =
      resolveCleanMasterpieceDetail(templateInput, detail) ??
      synthesizeMasterpieceDetail(templateInput);
  }

  const year = resolveArtworkYear({
    year: raw.year,
    artworkTitle: raw.artworkTitle,
    sourceUrl: raw.sourceUrl,
    aboutArtworkBody: raw.aboutArtworkBody,
  });

  const normalized = {
    editionDate: raw.editionDate ?? "",
    artworkId: raw.artworkId,
    artworkTitle,
    artist,
    year,
    sourceInstitution: raw.sourceInstitution?.trim() ?? "",
    sourceUrl: raw.sourceUrl?.trim() ?? "",
    license: raw.license?.trim() ?? "public_domain",
    licenseUrl: raw.licenseUrl ?? null,
    hostedUrl,
    imageUrl: hostedUrl,
    imageWidth,
    imageHeight,
    aspectRatio,
    creditLine:
      sanitizeEditorialText(raw.creditLine) ||
      sanitizeEditorialText(raw.attributionText) ||
      "",
    aboutArtworkBody,
    aboutWordCount: raw.aboutWordCount ?? 0,
    detail,
    collections: raw.collections ?? [],
  };
  masterpieceTraceEnd("normalize/sanitize", {
    ms: Date.now() - started,
    artworkId: normalized.artworkId,
    regeneratedDetail: Boolean(detail),
  });
  return normalized;
  } catch (error) {
    masterpieceTraceEnd("normalize/sanitize", {
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
