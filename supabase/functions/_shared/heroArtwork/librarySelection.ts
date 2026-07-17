import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkSelectionContext } from "./types.ts";
import {
  copyMorningHeroFromRecord,
  type MorningHeroExperience,
} from "./presentation.ts";
import { validateMorningHeroArticle } from "./articleValidation.ts";
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
import {
  morningHeroMetadataNeedsRepair,
  sanitizeMorningHeroExperience,
} from "./sanitizeRecord.ts";

export type ResolveMorningHeroFromLibraryInput = {
  editionDate: string;
  context?: HeroArtworkSelectionContext;
};

/**
 * Edition-build path — read the permanent library, pick today's artwork, freeze.
 * No Wikimedia, Claude, downloads, synthesis, or external APIs.
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
    const snapshot =
      frozen.presentationSnapshot as unknown as MorningHeroExperience;
    const sanitized = sanitizeMorningHeroExperience(snapshot);

    if (!validateMorningHeroArticle(sanitized)) {
      console.warn(
        "[heroArtwork] frozen snapshot failed article validation — not repairing at edition build",
        { editionDate, artworkId: sanitized.artworkId }
      );
      return null;
    }

    if (morningHeroMetadataNeedsRepair(snapshot, sanitized)) {
      await freezeHeroArtworkSelection(admin, editionDate, sanitized.artworkId, {
        selectionContext: frozen.selectionContext,
        presentation: sanitized,
      });
      console.log("[heroArtwork] sanitized metadata in frozen snapshot", {
        editionDate,
        artworkId: sanitized.artworkId,
      });
    }

    return sanitized;
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
    console.warn("[heroArtwork] library empty — no approved artwork ready", {
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
    console.warn("[heroArtwork] presentation build failed — artwork not fully approved", {
      editionDate,
      artworkId: selected.id,
    });
    return null;
  }

  const publishable = sanitizeMorningHeroExperience(presentation);
  if (!validateMorningHeroArticle(publishable)) {
    console.warn("[heroArtwork] selected artwork failed article validation", {
      editionDate,
      artworkId: selected.id,
      title: selected.artworkTitle,
    });
    return null;
  }

  await freezeHeroArtworkSelection(admin, editionDate, selected.id, {
    selectionContext: context,
    presentation: publishable,
  });
  await markHeroArtworkUsed(admin, selected.id, editionDate);

  console.log("[heroArtwork] daily hero selected from library", {
    editionDate,
    artworkId: selected.id,
    title: selected.artworkTitle,
    artist: selected.artist,
  });

  return publishable;
}
