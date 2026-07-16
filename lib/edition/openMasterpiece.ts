import type { Router } from "expo-router";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { stashMasterpiece } from "./masterpieceStore";

export type OpenMasterpieceOptions = {
  editionId?: string | null;
  backLabel?: string;
};

/**
 * Open Today's Masterpiece detail — data is already frozen on morningHero.
 * No network, generation, or external lookups.
 */
export function openMasterpiece(
  router: Pick<Router, "push">,
  morningHero: MorningHeroExperience,
  options: OpenMasterpieceOptions = {}
): void {
  const id = stashMasterpiece(morningHero);
  const backLabel = options.backLabel?.trim() || "← Today's paper";

  router.push({
    pathname: "/masterpiece/[id]" as const,
    params: {
      id,
      backLabel,
      ...(options.editionId ? { editionId: options.editionId } : {}),
    },
  });
}
