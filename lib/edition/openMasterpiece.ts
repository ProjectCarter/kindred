import type { Router } from "expo-router";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { normalizeMorningHeroExperience } from "./heroArtwork/normalize";
import { stashMasterpiece } from "./masterpieceStore";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "./masterpieceDiagnostics";

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
  masterpieceTraceBegin("navigation/openMasterpiece", {
    artworkId: morningHero.artworkId,
  });
  const started = Date.now();
  const normalized =
    normalizeMorningHeroExperience(morningHero) ?? morningHero;
  const id = stashMasterpiece(normalized);
  const backLabel = options.backLabel?.trim() || "← Today's paper";

  router.push({
    pathname: "/masterpiece/[id]" as const,
    params: {
      id,
      backLabel,
      ...(options.editionId ? { editionId: options.editionId } : {}),
    },
  });
  masterpieceTraceEnd("navigation/openMasterpiece", {
    ms: Date.now() - started,
    artworkId: id,
  });
}
