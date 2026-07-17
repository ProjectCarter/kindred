/**
 * Recover Today's Masterpiece when editions.morning_edition lost morningHero
 * but the frozen library selection still holds the presentation snapshot.
 */

import { supabase } from "../supabase";
import type { EditionIntelligence } from "./surfaceIntelligence";
import type { MorningHeroExperience } from "./heroArtwork/types";
import { parseMorningHeroExperience } from "./morningEdition";
import { normalizeMorningHeroExperience } from "./heroArtwork/normalize";
import {
  mergeMorningHeroIntoIntelligence,
  needsMorningHeroRecovery,
  resolveMorningHero,
} from "./resolveMorningHero";
import type { CachedEditionBundle } from "./editionCache";
import {
  masterpieceTraceAsync,
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "./masterpieceDiagnostics";

const RECOVERY_THROTTLE_MS = 60_000;
const lastRecoveryAt = new Map<string, number>();

export type MorningHeroRecoveryResult = {
  attempted: boolean;
  recovered: boolean;
  intelligence: EditionIntelligence | null;
  morningHero: MorningHeroExperience | null;
  source?: "frozen_selection" | "cache" | null;
  error?: string | null;
};

function canAttemptRecovery(editionDate: string): boolean {
  const last = lastRecoveryAt.get(editionDate) ?? 0;
  return Date.now() - last >= RECOVERY_THROTTLE_MS;
}

function markRecoveryAttempt(editionDate: string): void {
  lastRecoveryAt.set(editionDate, Date.now());
}

async function fetchFrozenMorningHero(
  editionDate: string
): Promise<MorningHeroExperience | null> {
  return masterpieceTraceAsync("snapshot/fetchFrozenMorningHero", async () => {
    const { data, error } = await supabase
      .from("kindred_hero_artwork_edition_selections")
      .select("presentation_snapshot")
      .eq("edition_date", editionDate)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn("[morningHero:recovery] frozen selection fetch error", {
          editionDate,
          message: error.message,
        });
      }
      return null;
    }

    const snapshot = data?.presentation_snapshot;
    if (!snapshot || typeof snapshot !== "object") return null;

    return (
      normalizeMorningHeroExperience(
        snapshot as Partial<MorningHeroExperience>
      ) ??
      parseMorningHeroExperience(snapshot) ??
      null
    );
  }, { editionDate });
}

export async function recoverMorningHero(params: {
  editionDate: string;
  intelligence: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
}): Promise<MorningHeroRecoveryResult> {
  masterpieceTraceBegin("article/recoverMorningHero", {
    editionDate: params.editionDate,
  });
  const started = Date.now();

  const existing = resolveMorningHero({
    intelligence: params.intelligence,
    cachedBundle: params.cachedBundle,
  });

  if (existing) {
    masterpieceTraceEnd("article/recoverMorningHero", {
      ms: Date.now() - started,
      recovered: false,
      reason: "already_present",
    });
    return {
      attempted: false,
      recovered: false,
      intelligence: mergeMorningHeroIntoIntelligence(
        params.intelligence,
        existing
      ),
      morningHero: existing,
      source: params.intelligence?.morningHero ? null : "cache",
    };
  }

  if (!canAttemptRecovery(params.editionDate)) {
    masterpieceTraceEnd("article/recoverMorningHero", {
      ms: Date.now() - started,
      recovered: false,
      reason: "throttled",
    });
    return {
      attempted: false,
      recovered: false,
      intelligence: params.intelligence,
      morningHero: null,
    };
  }

  markRecoveryAttempt(params.editionDate);

  try {
    const frozen = await fetchFrozenMorningHero(params.editionDate);
    if (!frozen) {
      masterpieceTraceEnd("article/recoverMorningHero", {
        ms: Date.now() - started,
        recovered: false,
        reason: "no_snapshot",
      });
      return {
        attempted: true,
        recovered: false,
        intelligence: params.intelligence,
        morningHero: null,
      };
    }

    const intelligence = mergeMorningHeroIntoIntelligence(
      params.intelligence,
      frozen
    );

    if (__DEV__) {
      console.log("[morningHero:recovery] restored from frozen selection", {
        editionDate: params.editionDate,
        artworkId: frozen.artworkId,
        title: frozen.artworkTitle,
      });
    }

    masterpieceTraceEnd("article/recoverMorningHero", {
      ms: Date.now() - started,
      recovered: true,
      artworkId: frozen.artworkId,
    });

    return {
      attempted: true,
      recovered: true,
      intelligence,
      morningHero: frozen,
      source: "frozen_selection",
    };
  } catch (err) {
    masterpieceTraceEnd("article/recoverMorningHero", {
      ms: Date.now() - started,
      recovered: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      attempted: true,
      recovered: false,
      intelligence: params.intelligence,
      morningHero: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
