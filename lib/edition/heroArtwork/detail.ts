import type { MasterpieceDetail } from "./types";

function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function legacySections(detail: MasterpieceDetail): MasterpieceDetail | null {
  const body = detail.longStoryBody?.trim();
  if (!body) return null;

  const paragraphs = detail.longStoryParagraphs?.length
    ? detail.longStoryParagraphs
    : splitParagraphs(body);

  const sections = [
    {
      heading: "Introduction",
      paragraphs: paragraphs.slice(0, 1),
    },
    ...(detail.artistBiography?.trim()
      ? [
          {
            heading: "About the Artist",
            paragraphs: [detail.artistBiography.trim()],
          },
        ]
      : []),
    {
      heading: "The Story Behind the Artwork",
      paragraphs: paragraphs.slice(1, 3),
    },
    {
      heading: "Historical Context",
      paragraphs: paragraphs.slice(3, 4),
    },
    {
      heading: "Legacy",
      paragraphs: paragraphs.slice(4, 5),
    },
    {
      heading: "Editorial Closing",
      paragraphs: paragraphs.slice(5),
    },
  ].filter((section) => section.paragraphs.length > 0);

  return {
    ...detail,
    sections,
    lookingCloser:
      detail.lookingCloser?.length
        ? detail.lookingCloser
        : detail.lookCloserItems ?? [],
  };
}

/** Render-only — returns stored detail, never composes at runtime. */
export function renderMasterpieceDetail(
  morningHero: { detail?: MasterpieceDetail | null }
): MasterpieceDetail | null {
  const detail = morningHero.detail;
  if (!detail) return null;

  if (detail.sections?.length) {
    return {
      ...detail,
      lookingCloser:
        detail.lookingCloser?.length
          ? detail.lookingCloser
          : detail.lookCloserItems ?? [],
    };
  }

  return legacySections(detail);
}

export function hasMasterpieceDetail(
  morningHero: { detail?: MasterpieceDetail | null }
): boolean {
  return Boolean(renderMasterpieceDetail(morningHero));
}
