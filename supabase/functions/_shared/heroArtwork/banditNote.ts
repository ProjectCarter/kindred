import type { HeroArtworkRecord, HeroArtworkSeason } from "./types.ts";

export type BanditMood =
  | "calm"
  | "warm"
  | "cool"
  | "wonder"
  | "gentle"
  | "bright";

export type BanditNoteContext = {
  season?: HeroArtworkSeason | null;
  /** Optional weather hint — complements mood without explaining the artwork. */
  weatherHint?: "hot" | "cold" | "rain" | "clear" | null;
};

const NOTES_BY_MOOD: Record<BanditMood, string[]> = {
  calm: [
    "Hope you find something beautiful today.",
    "A quiet morning to begin with.",
    "Take your time with today.",
  ],
  warm: [
    "Looks like a wonderful morning for a walk.",
    "A gentle start to the day.",
    "Wishing you a soft, easy morning.",
  ],
  cool: [
    "Stay cool today.",
    "A crisp morning — dress accordingly.",
    "Take it slow if the air feels sharp.",
  ],
  wonder: [
    "Something remarkable to begin with.",
    "A good morning for looking closely.",
    "Curiosity is a fine way to start.",
  ],
  gentle: [
    "Glad you're here this morning.",
    "Bandit saved you a place at the table.",
    "However today unfolds, begin gently.",
  ],
  bright: [
    "The light looks promising today.",
    "A bright page to turn.",
    "Good morning — the day is waiting.",
  ],
};

function inferMood(
  artwork: HeroArtworkRecord,
  context: BanditNoteContext
): BanditMood {
  const moods = artwork.moodTags ?? [];
  if (moods.includes("wonder")) return "wonder";
  if (moods.includes("calm")) return "calm";
  if (moods.includes("warm")) return "warm";
  if (moods.includes("cool")) return "cool";
  if (moods.includes("bright")) return "bright";

  if (context.weatherHint === "hot") return "warm";
  if (context.weatherHint === "cold") return "cool";
  if (context.weatherHint === "rain") return "calm";
  if (context.season === "summer") return "bright";
  if (context.season === "winter") return "cool";
  return "gentle";
}

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

/**
 * Bandit welcomes the reader — complements the artwork's mood without explaining it.
 * One or two quiet sentences; never a joke; never exclamation-heavy.
 */
export function selectBanditMorningNote(
  artwork: HeroArtworkRecord,
  context: BanditNoteContext & { editionDate?: string | null } = {}
): string {
  if (artwork.banditMorningNote?.trim()) {
    return artwork.banditMorningNote.trim();
  }

  const mood = inferMood(artwork, context);
  const pool = NOTES_BY_MOOD[mood];
  const seed = `${context.editionDate ?? "today"}:${artwork.internalId}:${mood}`;
  return pool[stableIndex(seed, pool.length)] ?? NOTES_BY_MOOD.gentle[0];
}
