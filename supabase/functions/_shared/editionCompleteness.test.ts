import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessPersistedEditionBuild,
  candidateDiscoveryPassesCompleteness,
  discoverySurfaceItemCount,
} from "./editionCompleteness.ts";
import type { DiscoveryPayload, RankedDiscoveryItem } from "./discovery/types.ts";

function ranked(
  id: string,
  category: RankedDiscoveryItem["item"]["category"],
  score = 80
): RankedDiscoveryItem {
  return {
    score,
    item: {
      id,
      title: `Place ${id}`,
      dek: "A calm neighborhood spot worth a visit.",
      category,
      family: "food_drink",
      tags: [],
      source: { name: "Verified Source", tier: "local" },
      url: "https://example.com",
      venueCategories: category === "activities" ? ["Escape Room"] : [],
      lat: 33.35,
      lon: -111.79,
      seasons: [],
      weatherFit: [],
      popularity: 0,
      uniqueness: 0,
      reasons: [],
      editorialConfidence: {
        score: 92,
        action: "publish",
        signals: [],
        completeness: true,
        verified: true,
        scoredAt: new Date().toISOString(),
      },
    } as unknown as RankedDiscoveryItem["item"],
    reasons: [],
  } as unknown as RankedDiscoveryItem;
}

function sampleDiscovery(
  activities: RankedDiscoveryItem[],
  recommendations: RankedDiscoveryItem[]
): DiscoveryPayload {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate: "2026-07-16",
    location: {
      city: "Gilbert",
      region: "AZ",
      state: "AZ",
      lat: 33.35,
      lon: -111.79,
    },
    surfaces: {
      activities: {
        surface: "activities",
        headline: "Activities",
        editorNote: "",
        items: activities,
      },
      coffee: {
        surface: "coffee",
        headline: "Coffee",
        editorNote: "",
        items: recommendations,
      },
    },
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: activities.length + recommendations.length,
      selectedCount: activities.length + recommendations.length,
      editorNotes: [],
      enrichQueue: [],
    },
  };
}

const baseSections = [
  { section_type: "weather", headline: "Weather", body: "Sunny" },
  { section_type: "local_events", headline: "Events", body: "[]" },
  { section_type: "today_in_history", headline: "History", body: "On this day" },
];

Deno.test("assessPersistedEditionBuild rejects empty discovery surfaces", () => {
  const empty: DiscoveryPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate: "2026-07-16",
    location: { city: "Gilbert", region: "AZ", state: "AZ", lat: null, lon: null },
    surfaces: {},
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: 667,
      selectedCount: 0,
      editorNotes: [],
      enrichQueue: [],
    },
  };

  const result = assessPersistedEditionBuild({
    sections: baseSections,
    discovery: empty,
    hasBanditsPick: true,
  });

  assertEquals(result.complete, false);
  assertEquals(result.reasons.includes("discovery has zero surfaced items"), true);
  assertEquals(
    result.reasons.includes("discovery pool has zero activities after allocate"),
    true
  );
});

Deno.test("assessPersistedEditionBuild accepts complete persisted payload", () => {
  const discovery = sampleDiscovery(
    [ranked("act1", "activities")],
    [ranked("rec1", "coffee")]
  );

  assertEquals(discoverySurfaceItemCount(discovery) > 0, true);

  const result = assessPersistedEditionBuild({
    sections: baseSections,
    discovery,
    hasBanditsPick: true,
  });

  assertEquals(result.complete, true);
  assertEquals(result.reasons.length, 0);
});

Deno.test("assessPersistedEditionBuild skips catalog desks before bootstrap", () => {
  const discovery = sampleDiscovery([], []);
  const sectionsWithoutEvents = baseSections.filter(
    (s) => s.section_type !== "local_events"
  );

  const pending = assessPersistedEditionBuild({
    sections: sectionsWithoutEvents,
    discovery,
    hasBanditsPick: true,
    catalogBootstrap: {
      eventsCatalogBootstrapped: false,
      activitiesCatalogBootstrapped: false,
      foodDrinkCatalogBootstrapped: false,
    },
  });

  assertEquals(pending.complete, true);
});

Deno.test("assessPersistedEditionBuild requires morning hero when library has artwork", () => {
  const discovery = sampleDiscovery(
    [ranked("act1", "activities")],
    [ranked("rec1", "coffee")]
  );

  const missingHero = assessPersistedEditionBuild({
    sections: baseSections,
    discovery,
    hasBanditsPick: true,
    libraryHasHeroArtwork: true,
    hasMorningHero: false,
  });

  assertEquals(missingHero.complete, false);
  assertEquals(
    missingHero.reasons.includes(
      "morning_hero missing while hero library has eligible artwork"
    ),
    true
  );
});

Deno.test("assessPersistedEditionBuild requires story_of when expected", () => {
  const discovery = sampleDiscovery(
    [ranked("act1", "activities")],
    [ranked("rec1", "coffee")]
  );

  const withoutStory = assessPersistedEditionBuild({
    sections: baseSections,
    discovery,
    hasBanditsPick: true,
    expectStoryOf: true,
  });
  assertEquals(withoutStory.complete, false);
  assertEquals(
    withoutStory.reasons.includes("edition_sections missing story_of"),
    true
  );

  const withStory = assessPersistedEditionBuild({
    sections: [
      ...baseSections,
      { section_type: "story_of", headline: "The Story of Gilbert", body: "Body" },
    ],
    discovery,
    hasBanditsPick: true,
    expectStoryOf: true,
  });
  assertEquals(withStory.complete, true);
});

Deno.test("candidateDiscoveryPassesCompleteness blocks incomplete overwrite", () => {
  const valid = sampleDiscovery(
    [ranked("act1", "activities")],
    [ranked("rec1", "restaurants")]
  );
  const empty: DiscoveryPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate: "2026-07-16",
    location: { city: "Gilbert", region: "AZ", state: "AZ", lat: 33.35, lon: -111.79 },
    surfaces: {},
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: 100,
      selectedCount: 0,
      editorNotes: [],
      enrichQueue: [],
    },
  };

  const allowed = candidateDiscoveryPassesCompleteness({
    editionId: "test",
    candidateDiscovery: valid,
    sections: baseSections,
    bandit: { pick: { story: { headline: "Pick headline", summary: "Summary" } } },
  });
  assertEquals(allowed.allowed, true);

  const rejected = candidateDiscoveryPassesCompleteness({
    editionId: "test",
    candidateDiscovery: empty,
    sections: baseSections,
    bandit: { pick: { story: { headline: "Pick headline", summary: "Summary" } } },
  });
  assertEquals(rejected.allowed, false);
});
