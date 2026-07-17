import type { MorningHeroExperience } from "./heroArtwork/types";
import { normalizeMorningHeroExperience } from "./heroArtwork/normalize";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "./masterpieceDiagnostics";

/**
 * In-memory handoff for Today's Masterpiece detail — no network on open.
 */
const MAX_STASHED = 8;
const store = new Map<string, MorningHeroExperience>();

function touch(id: string, experience: MorningHeroExperience): void {
  store.delete(id);
  store.set(id, experience);
  while (store.size > MAX_STASHED) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function stashMasterpiece(
  experience: MorningHeroExperience
): string {
  const id = experience.artworkId;
  touch(id, experience);
  return id;
}

export function getStashedMasterpiece(
  id: string
): MorningHeroExperience | null {
  masterpieceTraceBegin("article/stash-read", { artworkId: id });
  const started = Date.now();
  const experience = store.get(id);
  if (!experience) {
    masterpieceTraceEnd("article/stash-read", {
      ms: Date.now() - started,
      found: false,
    });
    return null;
  }
  const normalized = normalizeMorningHeroExperience(experience) ?? experience;
  touch(id, normalized);
  masterpieceTraceEnd("article/stash-read", {
    ms: Date.now() - started,
    found: true,
  });
  return normalized;
}
