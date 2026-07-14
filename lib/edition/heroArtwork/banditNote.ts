import type { HeroArtworkAsset } from "./types";
import type { HeroArtworkSeason } from "./types";

const NOTES = {
  calm: ["Hope you find something beautiful today.", "A quiet morning to begin with."],
  warm: ["Looks like a wonderful morning for a walk.", "A gentle start to the day."],
  cool: ["Stay cool today.", "Take it slow if the air feels sharp."],
  gentle: ["Glad you're here this morning.", "However today unfolds, begin gently."],
} as const;

export function selectBanditMorningNote(
  asset: HeroArtworkAsset,
  context: { editionDate?: string | null; season?: HeroArtworkSeason | null } = {}
): string {
  if (asset.banditMorningNote?.trim()) return asset.banditMorningNote.trim();

  const mood = asset.moodTags.includes("calm")
    ? "calm"
    : asset.moodTags.includes("warm")
      ? "warm"
      : context.season === "winter"
        ? "cool"
        : "gentle";

  const pool = NOTES[mood];
  const seed = `${context.editionDate ?? "today"}:${asset.internalId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}
