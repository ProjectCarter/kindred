import test from "node:test";
import assert from "node:assert/strict";

const SAMPLE_HERO = {
  artworkId: "c08e165f-463b-4716-9076-50fb43932534",
  artworkTitle: "The Great Wave",
  artist: "Katsushika Hokusai",
  hostedUrl: "https://example.com/wave.jpg",
  aboutArtworkBody:
    "Hokusai captured a cresting wave with boats beneath Mount Fuji.",
  imageWidth: 1400,
  imageHeight: 933,
  aspectRatio: 1.5,
};

async function loadMorningEditionModule() {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  return import("./morningEdition.ts");
}

test("parseMorningEditionPayload rejects staged compact snapshot", async () => {
  const { parseMorningEditionPayload } = await loadMorningEditionModule();
  const compact = { morningHero: SAMPLE_HERO, heroArtworkId: SAMPLE_HERO.artworkId };
  assert.equal(parseMorningEditionPayload(compact), null);
});

test("morningHeroFromEdition reads compact staged morning_edition snapshot", async () => {
  const { morningHeroFromEdition } = await loadMorningEditionModule();
  const compact = { morningHero: SAMPLE_HERO, heroArtworkId: SAMPLE_HERO.artworkId };
  const hero = morningHeroFromEdition({ morning_edition: compact });
  assert.equal(hero?.artworkId, SAMPLE_HERO.artworkId);
  assert.equal(hero?.artworkTitle, SAMPLE_HERO.artworkTitle);
  assert.equal(hero?.artist, SAMPLE_HERO.artist);
});

test("morningHeroFromEdition still reads full MorningEditionPayload", async () => {
  const { morningHeroFromEdition } = await loadMorningEditionModule();
  const full = {
    version: 1 as const,
    generatedAt: "2026-07-18T12:00:00.000Z",
    editionDate: "2026-07-18",
    location: { city: "Gilbert", region: null, state: "AZ" },
    banditLine: null,
    beats: {
      welcome: null,
      leadWhy: null,
      overnight: null,
      continuing: null,
      balance: null,
      local: null,
      weather: null,
      seasonal: null,
      weekendTone: null,
      discoveries: null,
      knowledge: null,
      memory: null,
      bandit: null,
    },
    briefings: {
      opening_20s: {
        length: "opening_20s" as const,
        text: "Good morning.",
        paragraphs: ["Good morning."],
        estimatedSeconds: 20,
        wordCount: 2,
      },
      briefing_60s: {
        length: "briefing_60s" as const,
        text: "Good morning.",
        paragraphs: ["Good morning."],
        estimatedSeconds: 60,
        wordCount: 2,
      },
      overview_3m: {
        length: "overview_3m" as const,
        text: "Good morning.",
        paragraphs: ["Good morning."],
        estimatedSeconds: 180,
        wordCount: 2,
      },
    },
    defaultLength: "briefing_60s" as const,
    channelHints: ["in_app" as const],
    editorBrief: "",
    selectionMeta: {
      usedEngines: [],
      polishedWithAi: false,
      editorNotes: [],
    },
    morningHero: SAMPLE_HERO,
  };

  const hero = morningHeroFromEdition({ morning_edition: full });
  assert.equal(hero?.artworkTitle, SAMPLE_HERO.artworkTitle);
});
