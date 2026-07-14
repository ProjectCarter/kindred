/**
 * Separate from editionFreeze.ts hero photography id — artwork masthead freeze
 * will wire here when UI switches to the Hero Artwork desk.
 */
let frozenHeroArtworkId: string | null = null;
let frozenHeroArtworkEditionDate: string | null = null;

export function getFrozenHeroArtworkId(editionDate?: string | null): string | null {
  if (editionDate && frozenHeroArtworkEditionDate !== editionDate) return null;
  return frozenHeroArtworkId;
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
}
