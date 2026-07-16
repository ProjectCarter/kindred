import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkSelectionContext } from "./types.ts";
import {
  copyMorningHeroFromRecord,
  type MorningHeroExperience,
} from "./presentation.ts";
import {
  freezeHeroArtworkSelection,
  getFrozenHeroArtworkSelection,
  listReadyHeroArtworkLibrary,
  markHeroArtworkUsed,
} from "./library.ts";
import {
  listRecentHeroArtworkRotation,
  selectDailyHeroFromPool,
} from "./ensurePool.ts";
import { getSeason, parseEditionDate } from "./select.ts";

export type ResolveMorningHeroFromLibraryInput = {
  editionDate: string;
  context?: HeroArtworkSelectionContext;
};

/**
 * Edition-build path — read the permanent library, pick today's artwork, freeze.
 * No Wikimedia, Claude, downloads, or external APIs.
 */
export async function resolveMorningHeroFromLibrary(
  admin: SupabaseClient,
  input: ResolveMorningHeroFromLibraryInput
): Promise<MorningHeroExperience | null> {
  const { editionDate } = input;

  const frozen = await getFrozenHeroArtworkSelection(admin, editionDate);
  if (
    frozen?.presentationSnapshot &&
    typeof frozen.presentationSnapshot === "object" &&
    "artworkId" in frozen.presentationSnapshot
  ) {
    return frozen.presentationSnapshot as unknown as MorningHeroExperience;
  }

  const rotation = await listRecentHeroArtworkRotation(admin);
  const date = parseEditionDate(editionDate);
  const context: HeroArtworkSelectionContext = {
    ...input.context,
    date: editionDate,
    season: input.context?.season ?? getSeason(date.getMonth() + 1),
    recentArtworkIds: [
      ...(input.context?.recentArtworkIds ?? []),
      ...rotation.recentArtworkIds,
    ],
    recentCollectionIds: [
      ...(input.context?.recentCollectionIds ?? []),
      ...rotation.recentCollectionIds,
    ],
  };

  const catalog = await listReadyHeroArtworkLibrary(admin);
  if (!catalog.length) {
    console.warn("[heroArtwork] library empty — no hosted artwork ready", {
      editionDate,
    });
    return null;
  }

  const selected = await selectDailyHeroFromPool(catalog, editionDate, context);
  if (!selected) {
    console.warn("[heroArtwork] no selectable artwork in library", {
      editionDate,
      catalogSize: catalog.length,
    });
    return null;
  }

  const presentation = copyMorningHeroFromRecord(selected, editionDate);

  if (!presentation) {
    console.warn("[heroArtwork] presentation build failed", {
      editionDate,
      artworkId: selected.id,
    });
    return null;
  }

  await freezeHeroArtworkSelection(admin, editionDate, selected.id, {
    selectionContext: context,
    presentation,
  });
  await markHeroArtworkUsed(admin, selected.id);

  console.log("[heroArtwork] daily hero selected from library", {
    editionDate,
    artworkId: selected.id,
    title: selected.artworkTitle,
    artist: selected.artist,
    hostedUrl: selected.hostedUrl,
  });

  return presentation;
}
