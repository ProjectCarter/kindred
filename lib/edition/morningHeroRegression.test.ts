import test from "node:test";
import assert from "node:assert/strict";
import type { CachedEditionBundle } from "./editionCache.ts";
import type { EditionIntelligence } from "./surfaceIntelligence.ts";
import type { MorningHeroExperience } from "./heroArtwork/types.ts";
import {
  mergeMorningHeroIntoCachedBundle,
  mergeMorningHeroIntoIntelligence,
  needsMorningHeroRecovery,
  needsNetworkMorningHeroMerge,
  resolveMorningHero,
} from "./resolveMorningHero.ts";
import { isCachedEditionPaintable } from "./instantEdition.ts";
import { mergeFrozenSections } from "./editionFreeze.ts";
import type { EditionSection } from "./types.ts";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const sampleHero: MorningHeroExperience = {
  editionDate: "2026-07-17",
  artworkId: "hero-1",
  artworkTitle: "Starry Night",
  artist: "Vincent van Gogh",
  year: "1889",
  sourceInstitution: "Museum of Modern Art",
  sourceUrl: "https://example.com/art",
  license: "public_domain",
  licenseUrl: null,
  hostedUrl: "https://cdn.example.com/starry.jpg",
  imageUrl: "https://cdn.example.com/starry.jpg",
  imageWidth: 1400,
  imageHeight: 933,
  aspectRatio: 1.5,
  creditLine: "Public domain via MoMA",
  aboutArtworkBody:
    "Van Gogh painted this night sky from memory and imagination, turning a quiet village into a field of motion.",
  aboutWordCount: 18,
  collections: ["post_impressionism"],
  detail: {
    sections: [
      { heading: "Introduction", paragraphs: ["Intro paragraph one."] },
      { heading: "About the Artist", paragraphs: ["Artist paragraph one."] },
      { heading: "The Story Behind the Artwork", paragraphs: ["Story one."] },
      { heading: "Historical Context", paragraphs: ["Context one."] },
      { heading: "Legacy", paragraphs: ["Legacy one."] },
      { heading: "Editorial Reflection", paragraphs: ["Reflection one."] },
    ],
    lookingCloser: ["Look at the sky.", "Notice the village."],
    didYouKnow: "The painting is in MoMA's permanent collection.",
    museumName: "Museum of Modern Art",
    museumLocation: "New York, United States",
    officialMuseumUrl: "https://example.com/moma",
    officialArtworkUrl: "https://example.com/art",
    sourceReferences: ["https://example.com/art"],
  },
};

function intelligenceWithoutHero(): EditionIntelligence {
  return {
    discovery: null,
    knowledge: null,
    memory: null,
    morning: null,
    morningOpening: null,
    morningBriefing: null,
    morningHero: null,
    banditAside: null,
    memoryNote: null,
    discoveryItems: [],
    discoveryHeadline: "Worth your time",
    discoveryEditorNote: null,
    leadWhyThisMatters: null,
    leadWhyChosen: null,
    leadContinuityKicker: null,
    banditsPick: null,
    historyAroundTown: null,
    weatherSummary: null,
    weatherSnapshot: null,
  };
}

function baseSection(type: string): EditionSection {
  return {
    id: `${type}-1`,
    edition_id: "edition-1",
    section_type: type,
    position: 1,
    headline: type,
    body: type,
    source_note: null,
  };
}

test("resolveMorningHero prefers intelligence then cache top-level field", () => {
  const intel = { ...intelligenceWithoutHero(), morningHero: sampleHero };
  const bundle: CachedEditionBundle = {
    userId: "u1",
    editionId: "e1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: intelligenceWithoutHero(),
    morningHero: sampleHero,
  };

  assert.equal(resolveMorningHero({ intelligence: intel })?.artworkId, "hero-1");
  assert.equal(
    resolveMorningHero({ intelligence: intelligenceWithoutHero(), cachedBundle: bundle })
      ?.artworkId,
    "hero-1"
  );
});

test("mergeMorningHeroIntoCachedBundle lifts top-level hero into intelligence", () => {
  const bundle: CachedEditionBundle = {
    userId: "u1",
    editionId: "e1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [baseSection("today_in_history")],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: intelligenceWithoutHero(),
    morningHero: sampleHero,
  };

  const merged = mergeMorningHeroIntoCachedBundle(bundle);
  assert.equal(merged.intelligence?.morningHero?.artworkId, "hero-1");
  assert.equal(merged.morningHero?.artworkId, "hero-1");
});

test("mergeMorningHeroIntoIntelligence preserves existing intelligence hero", () => {
  const intel = { ...intelligenceWithoutHero(), morningHero: sampleHero };
  const merged = mergeMorningHeroIntoIntelligence(intel, {
    ...sampleHero,
    artworkId: "other",
  });
  assert.equal(merged?.morningHero?.artworkId, "hero-1");
});

test("isCachedEditionPaintable allows hero-only partial rebuild", () => {
  const bundle: CachedEditionBundle = {
    userId: "u1",
    editionId: "e1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [baseSection("today_in_history")],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: intelligenceWithoutHero(),
    morningHero: sampleHero,
  };

  assert.equal(isCachedEditionPaintable(bundle, "2026-07-17"), true);
});

test("mergeFrozenSections preserves narrative sections when catalog sync patches events only", () => {
  const cached: EditionSection[] = [
    baseSection("today_in_history"),
    {
      ...baseSection("local_events"),
      body: JSON.stringify({ events: [{ id: "old-event" }] }),
    },
  ];
  const network: EditionSection[] = [
    baseSection("today_in_history"),
    {
      ...baseSection("local_events"),
      id: "local_events-2",
      body: JSON.stringify({ events: [{ id: "catalog-event" }] }),
    },
  ];

  const merged = mergeFrozenSections(cached, network);
  const events = merged.find((s) => s.section_type === "local_events");
  assert.match(events?.body ?? "", /catalog-event/);
  assert.equal(merged.some((s) => s.section_type === "today_in_history"), true);
});

test("needsMorningHeroRecovery is true when intelligence and cache lack hero", () => {
  const bundle: CachedEditionBundle = {
    userId: "u1",
    editionId: "e1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: intelligenceWithoutHero(),
    morningHero: null,
  };

  assert.equal(
    needsMorningHeroRecovery(intelligenceWithoutHero(), bundle),
    true
  );
  assert.equal(
    needsMorningHeroRecovery(
      { ...intelligenceWithoutHero(), morningHero: sampleHero },
      bundle
    ),
    false
  );
});

test("resolveMorningHero reads morning_edition payload when intelligence is empty", () => {
  const hero = resolveMorningHero({
    intelligence: intelligenceWithoutHero(),
    morningEdition: { version: 1, briefings: {}, morningHero: sampleHero },
  });
  assert.equal(hero?.artworkTitle, "Starry Night");
});

test("needsNetworkMorningHeroMerge is true when network has hero cache does not", () => {
  const bundle: CachedEditionBundle = {
    userId: "u1",
    editionId: "e1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [baseSection("today_in_history")],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: intelligenceWithoutHero(),
    morningHero: null,
  };

  assert.equal(
    needsNetworkMorningHeroMerge({
      networkIntelligence: { ...intelligenceWithoutHero(), morningHero: sampleHero },
      onScreenIntelligence: bundle.intelligence,
      cachedBundle: bundle,
    }),
    true
  );
  assert.equal(
    needsNetworkMorningHeroMerge({
      networkIntelligence: { ...intelligenceWithoutHero(), morningHero: sampleHero },
      onScreenIntelligence: { ...intelligenceWithoutHero(), morningHero: sampleHero },
      cachedBundle: bundle,
    }),
    false
  );
});
