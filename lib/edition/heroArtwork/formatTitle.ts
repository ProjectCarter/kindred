import { resolveArtworkYear } from "./resolveYear";
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

/** Official display title — always resolves year from frozen metadata. */
export function masterpieceTitleLine(
  hero: Pick<
    MorningHeroExperience,
    "artworkTitle" | "year" | "sourceUrl" | "aboutArtworkBody"
  >
): string {
  return formatMasterpieceTitle(
    hero.artworkTitle,
    resolveArtworkYear(hero)
  );
}
