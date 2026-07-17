import {
  synthesizeMasterpieceDetail,
  type MasterpieceTemplateInput,
} from "./detailTemplate.ts";
import {
  masterpieceDetailIsCorrupt,
  validateMorningHeroArticle,
} from "./articleValidation.ts";
import type { MasterpieceDetail } from "./presentation.ts";
import { isFrozenDetailComplete } from "./detailTemplate.ts";

/** Build detail from clean structured inputs and reject corrupt synthesis output. */
export function buildValidatedMasterpieceDetail(
  input: MasterpieceTemplateInput
): MasterpieceDetail | null {
  const detail = synthesizeMasterpieceDetail(input);
  if (masterpieceDetailIsCorrupt(detail)) {
    console.warn("[heroArtwork] synthesized detail failed article validation", {
      artworkTitle: input.artworkTitle,
      artist: input.artist,
    });
    return null;
  }
  return detail;
}

export function resolveCleanMasterpieceDetail(
  input: MasterpieceTemplateInput,
  existing: MasterpieceDetail | null | undefined
): MasterpieceDetail | null {
  if (
    existing &&
    isFrozenDetailComplete(existing) &&
    !masterpieceDetailIsCorrupt(existing)
  ) {
    return existing;
  }

  return buildValidatedMasterpieceDetail(input);
}

export function assertPublishableMorningHeroDetail(
  hero: {
    artworkTitle: string;
    artist: string;
    aboutArtworkBody: string;
    creditLine?: string | null;
    detail?: MasterpieceDetail | null;
  }
): boolean {
  return validateMorningHeroArticle({
    artworkTitle: hero.artworkTitle,
    artist: hero.artist,
    aboutArtworkBody: hero.aboutArtworkBody,
    creditLine: hero.creditLine ?? "",
    detail: hero.detail ?? null,
  });
}
