import type { MorningHeroExperience } from "./heroArtwork/types";

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
  const experience = store.get(id);
  if (!experience) return null;
  touch(id, experience);
  return experience;
}
