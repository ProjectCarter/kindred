import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkSelectionContext } from "./types.ts";
import {
  copyMorningHeroFromRecord,
  type MorningHeroExperience,
} from "./presentation.ts";
import {
  getFrozenHeroArtworkSelection,
  getHeroArtworkById,
} from "./library.ts";
import {
  resolveMorningHeroFromLibrary,
  type ResolveMorningHeroFromLibraryInput,
} from "./librarySelection.ts";

export type ResolveProductionMorningHeroInput = ResolveMorningHeroFromLibraryInput;

/**
 * Production entry point — selects from the permanent Hero Artwork Library.
 * Background discovery (Wikimedia, Claude, hosting) runs separately via
 * grow-hero-artwork-library — never during edition build.
 */
export async function resolveProductionMorningHero(
  admin: SupabaseClient,
  input: ResolveProductionMorningHeroInput
): Promise<MorningHeroExperience | null> {
  return resolveMorningHeroFromLibrary(admin, input);
}

/** Rehydrate frozen artwork record when only the id is known. */
export async function loadFrozenMorningHero(
  admin: SupabaseClient,
  editionDate: string
): Promise<MorningHeroExperience | null> {
  const frozen = await getFrozenHeroArtworkSelection(admin, editionDate);
  if (
    frozen?.presentationSnapshot &&
    typeof frozen.presentationSnapshot === "object" &&
    "artworkId" in frozen.presentationSnapshot
  ) {
    return frozen.presentationSnapshot as unknown as MorningHeroExperience;
  }
  if (!frozen?.artworkId) return null;
  const artwork = await getHeroArtworkById(admin, frozen.artworkId);
  if (!artwork) return null;
  return copyMorningHeroFromRecord(artwork, editionDate);
}

export type { HeroArtworkSelectionContext };
