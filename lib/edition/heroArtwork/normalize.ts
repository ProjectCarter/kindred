import type {
  MasterpieceArticleSection,
  MorningHeroExperience,
  MasterpieceDetail,
} from "./types";

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
  if (!d.didYouKnow?.trim()) return null;
  if (!d.museumName?.trim() || !d.museumLocation?.trim()) return null;

  const sections = parseSections(d.sections);
  const lookingCloser = (d.lookingCloser ?? d.lookCloserItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  if (sections && lookingCloser.length >= 2) {
    return {
      sections,
      lookingCloser,
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

  if (!d.longStoryBody?.trim() || !d.artistBiography?.trim()) return null;
  if (lookingCloser.length < 2) return null;

  const paragraphs = d.longStoryBody
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    sections: [],
    lookingCloser,
    didYouKnow: d.didYouKnow.trim(),
    museumName: d.museumName.trim(),
    museumLocation: d.museumLocation.trim(),
    officialMuseumUrl: d.officialMuseumUrl?.trim() || null,
    officialArtworkUrl: d.officialArtworkUrl?.trim() || null,
    sourceReferences: (d.sourceReferences ?? [])
      .map((ref) => ref.trim())
      .filter(Boolean),
    longStoryBody: d.longStoryBody.trim(),
    longStoryParagraphs: paragraphs,
    artistBiography: d.artistBiography.trim(),
    lookCloserItems: lookingCloser,
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
