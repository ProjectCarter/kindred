import type { MorningHeroExperience } from "./types";

export type ArtworkCreditBlock = {
  title: string;
  artist: string;
  institution: string;
  licenseLabel: string;
  sourceUrl: string | null;
};

function licenseLabel(license: string): string {
  const key = license.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "cc0") return "CC0";
  if (key === "government_work") return "U.S. Government Work";
  return "Public Domain";
}

function institutionLine(sourceInstitution: string): string {
  const trimmed = sourceInstitution.trim();
  if (!trimmed) return "Open collection";
  if (/^courtesy of/i.test(trimmed)) return trimmed;
  if (/wikimedia commons/i.test(trimmed)) return "Courtesy of Wikimedia Commons";
  if (/museum|gallery|institution|archives/i.test(trimmed)) {
    return `Courtesy of ${trimmed.replace(/^the\s+/i, "the ")}`;
  }
  return `Courtesy of ${trimmed}`;
}

/** Editorial credit block — no raw URLs in display text. */
export function formatArtworkCreditBlock(
  morningHero: MorningHeroExperience
): ArtworkCreditBlock {
  const sourceUrl =
    morningHero.detail?.officialArtworkUrl?.trim() ||
    morningHero.detail?.officialMuseumUrl?.trim() ||
    morningHero.sourceUrl?.trim() ||
    null;

  return {
    title: morningHero.artworkTitle.trim(),
    artist: morningHero.artist.trim(),
    institution: institutionLine(morningHero.sourceInstitution),
    licenseLabel: licenseLabel(morningHero.license),
    sourceUrl,
  };
}
