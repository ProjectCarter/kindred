import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkSelectionContext } from "./types.ts";
import {
  buildMorningHeroExperience,
  type MorningHeroExperience,
} from "./presentation.ts";
import {
  freezeHeroArtworkSelection,
  getFrozenHeroArtworkSelection,
  getHeroArtworkById,
  markHeroArtworkUsed,
} from "./library.ts";
import {
  ensureHeroArtworkPool,
  listRecentHeroArtworkRotation,
  selectDailyHeroFromPool,
} from "./ensurePool.ts";
import { getSeason, parseEditionDate } from "./select.ts";

export type ResolveProductionMorningHeroInput = {
  editionDate: string;
  context?: HeroArtworkSelectionContext;
  anthropicApiKey: string;
};

/**
 * Production entry point — frozen daily artwork with auto-discovery,
 * license verification, editorial copy, and presentation snapshot.
 */
export async function resolveProductionMorningHero(
  admin: SupabaseClient,
  input: ResolveProductionMorningHeroInput
): Promise<MorningHeroExperience | null> {
  const { editionDate, anthropicApiKey } = input;

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

  const catalog = await ensureHeroArtworkPool(
    admin,
    editionDate,
    context,
    anthropicApiKey
  );

  const selected = await selectDailyHeroFromPool(
    catalog,
    editionDate,
    context
  );

  if (!selected) {
    console.warn("[heroArtwork] no selectable artwork after auto-discovery", {
      editionDate,
      catalogSize: catalog.length,
    });
    return null;
  }

  const presentation = buildMorningHeroExperience(selected, editionDate, {
    season: context.season ?? getSeason(date.getMonth() + 1),
    weatherHint: context.weatherHint ?? null,
  });

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

  console.log("[heroArtwork] production hero resolved", {
    editionDate,
    artworkId: selected.id,
    title: selected.artworkTitle,
    artist: selected.artist,
  });

  return presentation;
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
  return buildMorningHeroExperience(artwork, editionDate);
}
