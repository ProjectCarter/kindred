import type { MorningHeroExperience } from "./types";

/**
 * Separate from editionFreeze.ts hero photography — artwork masthead freeze.
 * Refreshing today's edition must never change today's artwork or editorial copy.
 */
let frozenHeroArtworkId: string | null = null;
let frozenHeroArtworkEditionDate: string | null = null;
let frozenMorningExperience: MorningHeroExperience | null = null;

export function getFrozenHeroArtworkId(editionDate?: string | null): string | null {
  if (editionDate && frozenHeroArtworkEditionDate !== editionDate) return null;
  return frozenHeroArtworkId;
}

export function getFrozenMorningHeroExperience(
  editionDate?: string | null
): MorningHeroExperience | null {
  if (editionDate && frozenHeroArtworkEditionDate !== editionDate) return null;
  return frozenMorningExperience;
}

export function setFrozenMorningHeroExperience(
  experience: MorningHeroExperience | null
): void {
  if (!experience) return;
  frozenHeroArtworkId = experience.artworkId;
  frozenHeroArtworkEditionDate = experience.editionDate;
  frozenMorningExperience = experience;
}

export function setFrozenHeroArtworkId(
  artworkId: string | null,
  editionDate?: string | null
): void {
  if (!artworkId) return;
  frozenHeroArtworkId = artworkId;
  if (editionDate) frozenHeroArtworkEditionDate = editionDate;
}

export function clearFrozenHeroArtwork(): void {
  frozenHeroArtworkId = null;
  frozenHeroArtworkEditionDate = null;
  frozenMorningExperience = null;
}
