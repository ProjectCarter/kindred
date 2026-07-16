import type { MasterpieceDetail } from "./types";

/** Render-only — returns stored detail, never composes at runtime. */
export function renderMasterpieceDetail(
  morningHero: { detail?: MasterpieceDetail | null }
): MasterpieceDetail | null {
  const detail = morningHero.detail;
  if (!detail?.longStoryBody?.trim()) return null;
  if (!detail.longStoryParagraphs?.length) {
    return {
      ...detail,
      longStoryParagraphs: detail.longStoryBody
        .trim()
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    };
  }
  return detail;
}

export function hasMasterpieceDetail(
  morningHero: { detail?: MasterpieceDetail | null }
): boolean {
  return Boolean(renderMasterpieceDetail(morningHero));
}
