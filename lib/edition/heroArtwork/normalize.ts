import type { MorningHeroExperience, MasterpieceDetail } from "./types";

function parseMasterpieceDetail(raw: unknown): MasterpieceDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<MasterpieceDetail>;
  if (!d.longStoryBody?.trim()) return null;
  if (!d.artistBiography?.trim()) return null;
  if (!Array.isArray(d.lookCloserItems) || d.lookCloserItems.length < 2) return null;
  if (!d.didYouKnow?.trim()) return null;
  if (!d.museumName?.trim() || !d.museumLocation?.trim()) return null;

  const paragraphs =
    Array.isArray(d.longStoryParagraphs) && d.longStoryParagraphs.length > 0
      ? d.longStoryParagraphs.map((p) => p.trim()).filter(Boolean)
      : d.longStoryBody
          .trim()
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);

  return {
    longStoryBody: d.longStoryBody.trim(),
    longStoryParagraphs: paragraphs,
    artistBiography: d.artistBiography.trim(),
    lookCloserItems: d.lookCloserItems.map((item) => item.trim()).filter(Boolean),
    didYouKnow: d.didYouKnow.trim(),
    museumName: d.museumName.trim(),
    museumLocation: d.museumLocation.trim(),
    officialMuseumUrl: d.officialMuseumUrl?.trim() || null,
    officialArtworkUrl: d.officialArtworkUrl?.trim() || null,
    sourceReferences: (d.sourceReferences ?? [])
      .map((ref) => ref.trim())
      .filter(Boolean),
  };
}

/** Normalize edition payload — supports legacy snapshots without dimensions. */
export function normalizeMorningHeroExperience(
  raw: Partial<MorningHeroExperience> & { attributionText?: string | null }
): MorningHeroExperience | null {
  const hostedUrl = raw.hostedUrl?.trim() || raw.imageUrl?.trim();
  if (
    !raw.artworkId ||
    !raw.artworkTitle?.trim() ||
    !raw.artist?.trim() ||
    !raw.aboutArtworkBody?.trim() ||
    !hostedUrl
  ) {
    return null;
  }

  const imageWidth = raw.imageWidth ?? 1400;
  const imageHeight = raw.imageHeight ?? Math.round(1400 / (raw.aspectRatio ?? 1.5));
  const aspectRatio =
    raw.aspectRatio ?? Number((imageWidth / imageHeight).toFixed(6));

  return {
    editionDate: raw.editionDate ?? "",
    artworkId: raw.artworkId,
    artworkTitle: raw.artworkTitle.trim(),
    artist: raw.artist.trim(),
    year: raw.year ?? null,
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
      raw.creditLine?.trim() ||
      raw.attributionText?.trim() ||
      "",
    aboutArtworkBody: raw.aboutArtworkBody.trim(),
    aboutWordCount: raw.aboutWordCount ?? 0,
    detail: parseMasterpieceDetail(raw.detail),
    collections: raw.collections ?? [],
  };
}
