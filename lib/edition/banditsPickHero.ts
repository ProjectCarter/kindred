/**
 * Bandit's Pick hero imagery — disabled for V1 text-only listings.
 */

import type { ImageSourcePropType } from "react-native";
import type { BanditsPick } from "./bandit";
import type { ArticleHeroImage } from "./articleHero";

export function resolveBanditsPickHero(_input: {
  id: string;
  kind: BanditsPick["kind"];
  headline: string;
  imageUrl?: string | null;
  imageCaption?: string | null;
  heroMomentId?: string | null;
  discoveryItem?: BanditsPick["story"]["discoveryItem"];
  editionDate?: string | null;
}): ArticleHeroImage | null {
  return null;
}

export function resolveBanditsPickCardImage(
  _pick: BanditsPick,
  _editionDate?: string | null
): ImageSourcePropType | null {
  return null;
}

export function momentIdFromBanditPickId(pickId: string): string | null {
  const match = pickId.match(/^bandit_seasonal_(.+)$/);
  return match?.[1] ?? null;
}

/** Client mirror of server heroSubject.ts — keep search titles in sync. */
export const BANDIT_HERO_SUBJECTS: Record<
  string,
  {
    momentId: string;
    genericOk: boolean;
    headlinePattern: RegExp;
    bundledAssetId?: string;
  }
> = {};
