import { resolveArtworkYear } from "./resolveYear";
import { resolveMasterpieceDisplayTitle } from "./displayTitle";
import type { MorningHeroExperience } from "./types";

/** Title line for Today's Masterpiece — artwork name with year in parentheses. */
export function formatMasterpieceTitle(
  title: string,
  year: string | null | undefined
): string {
  const trimmed = title.trim();
  const yearTrimmed = year?.trim();
  if (!yearTrimmed) return trimmed;
  return `${trimmed} (${yearTrimmed})`;
}

/** English-facing title with year — homepage, reader headline, credits. */
export function masterpieceTitleLine(
  hero: Pick<
    MorningHeroExperience,
    "artworkTitle" | "year" | "sourceUrl" | "aboutArtworkBody"
  >
): string {
  const { displayTitle } = resolveMasterpieceDisplayTitle(hero.artworkTitle);
  return formatMasterpieceTitle(displayTitle, resolveArtworkYear(hero));
}

/** Original title for the full article when it differs from the English display. */
export function masterpieceOriginalTitle(
  hero: Pick<MorningHeroExperience, "artworkTitle">
): string | null {
  return resolveMasterpieceDisplayTitle(hero.artworkTitle).originalTitle;
}
