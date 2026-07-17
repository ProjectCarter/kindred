import {
  synthesizeMasterpieceDetail,
  isFrozenDetailComplete,
  type MasterpieceTemplateInput,
} from "./detailTemplate";
import {
  masterpieceDetailIsCorrupt,
  validateMorningHeroArticle,
} from "./articleValidation";
import type { MasterpieceDetail } from "./types";

/** Build detail from clean structured inputs and reject corrupt synthesis output. */
export function buildValidatedMasterpieceDetail(
  input: MasterpieceTemplateInput
): MasterpieceDetail | null {
  const detail = synthesizeMasterpieceDetail(input);
  if (masterpieceDetailIsCorrupt(detail)) {
    if (__DEV__) {
      console.warn("[masterpiece] synthesized detail failed article validation", {
        artworkTitle: input.artworkTitle,
        artist: input.artist,
      });
    }
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

export function assertPublishableMorningHeroDetail(hero: {
  artworkTitle: string;
  artist: string;
  aboutArtworkBody: string;
  creditLine?: string | null;
  detail?: MasterpieceDetail | null;
}): boolean {
  return validateMorningHeroArticle({
    artworkTitle: hero.artworkTitle,
    artist: hero.artist,
    aboutArtworkBody: hero.aboutArtworkBody,
    creditLine: hero.creditLine ?? "",
    detail: hero.detail ?? null,
  });
}
