import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverySurfaceItemCount,
  hasUsableDiscovery,
  needsNetworkDiscoveryMerge,
} from "./resolveDiscoverySync.ts";
import type { DiscoveryPayload } from "./discovery.ts";

const SAMPLE_DISCOVERY: DiscoveryPayload = {
  version: 1,
  generatedAt: "2026-07-21T12:00:00.000Z",
  editionDate: "2026-07-21",
  location: { city: "Gilbert", region: "AZ", state: "AZ", lat: 33.3, lon: -111.7 },
  surfaces: {
    activities: {
      surface: "activities",
      headline: "Activities",
      editorNote: "",
      items: [
        {
          item: {
            id: "act-1",
            title: "Escape Room",
            dek: "Bookable fun",
            category: "activities",
            family: "experience",
            source: { name: "Kindred", tier: "local" },
            tags: [],
          },
          score: 80,
          reasons: [],
          surfaces: ["activities"],
        },
      ],
    },
  },
  picks: [],
  editorBrief: "",
  selectionMeta: {
    candidateCount: 1,
    selectedCount: 1,
    editorNotes: [],
  },
};

test("needsNetworkDiscoveryMerge when cache lacks discovery", () => {
  assert.equal(
    needsNetworkDiscoveryMerge({
      networkIntelligence: {
        discovery: SAMPLE_DISCOVERY,
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
      },
      onScreenIntelligence: {
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
      },
    }),
    true
  );
});

test("needsNetworkDiscoveryMerge is false when cache already has discovery", () => {
  const intel = {
    discovery: SAMPLE_DISCOVERY,
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
  };
  assert.equal(
    needsNetworkDiscoveryMerge({
      networkIntelligence: intel,
      onScreenIntelligence: intel,
    }),
    false
  );
});

test("discoverySurfaceItemCount counts surfaced items only", () => {
  assert.equal(discoverySurfaceItemCount(SAMPLE_DISCOVERY), 1);
  assert.equal(discoverySurfaceItemCount(null), 0);
});

test("hasUsableDiscovery reads raw discovery json", () => {
  assert.equal(
    hasUsableDiscovery({ discoveryRaw: SAMPLE_DISCOVERY }),
    true
  );
});
