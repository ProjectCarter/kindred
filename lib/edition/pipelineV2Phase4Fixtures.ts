/**
 * Phase 4 QA fixtures — synthetic but structurally valid edition bundles per city.
 */

import type { DiscoveryPayload, RankedDiscoveryItem } from "./discovery.ts";
import type { EditionSection } from "./types.ts";
import type { LeadStory } from "./LeadStory.ts";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import type { MorningHeroExperience } from "./heroArtwork/types.ts";
import type { Phase4EditionInput } from "./pipelineV2Phase4QA.ts";
import type { Phase4CitySpec } from "./pipelineV2Phase4Cities.ts";
import { PHASE4_QA_CITIES } from "./pipelineV2Phase4Cities.ts";

const SHARED_NATIONAL_ID = "national-daily-fixture-1";
const EDITION_DATE = "2026-07-22";

const SHARED_NATIONAL_NEWS: NationalNewsPackage = {
  packageId: SHARED_NATIONAL_ID,
  editionDate: EDITION_DATE,
  generatedAt: "2026-07-22T08:00:00.000Z",
  stories: [
    {
      id: "nat-1",
      rank: 1,
      headline: "Congress advances infrastructure package",
      summary:
        "Lawmakers moved a bipartisan infrastructure bill forward after months of negotiation.",
      sourceName: "Associated Press",
      sourceUrl: "https://example.com/infra",
      publishedAt: `${EDITION_DATE}T06:00:00.000Z`,
      category: "politics",
      image: {
        url: "https://cdn.kindred.test/national/infra.jpg",
        attribution: "AP Photo",
        licenseNote: "Editorial use",
      },
      verification: {
        editorialScore: 90,
        reasons: ["verified_wire"],
        pool: "national_daily",
      },
    },
    {
      id: "nat-2",
      rank: 2,
      headline: "Markets steady as inflation cools",
      summary: "Fresh government data showed inflation easing for a third consecutive month.",
      sourceName: "Reuters",
      sourceUrl: "https://example.com/markets",
      publishedAt: `${EDITION_DATE}T05:30:00.000Z`,
      category: "business",
      image: {
        url: "https://cdn.kindred.test/national/markets.jpg",
        attribution: "Reuters",
        licenseNote: "Editorial use",
      },
      verification: {
        editorialScore: 88,
        reasons: ["verified_wire"],
        pool: "national_daily",
      },
    },
  ],
};

const SHARED_MASTERPIECE: MorningHeroExperience = {
  editionDate: EDITION_DATE,
  artworkId: "art-shared-v1",
  artworkTitle: "The Starry Night",
  artist: "Vincent van Gogh",
  year: "1889",
  sourceInstitution: "Museum of Modern Art",
  sourceUrl: "https://www.moma.org",
  license: "Public Domain",
  hostedUrl: "https://cdn.kindred.test/masterpiece/starry-night.jpg",
  imageUrl: "https://cdn.kindred.test/masterpiece/starry-night.jpg",
  imageWidth: 1200,
  imageHeight: 900,
  aspectRatio: 4 / 3,
  creditLine: "Vincent van Gogh, The Starry Night (1889)",
  aboutArtworkBody:
    "Van Gogh painted this swirling night sky from memory and imagination while recovering in Saint-Rémy, turning a quiet village into one of the most recognizable skies in art.",
  aboutWordCount: 32,
};

function ranked(
  id: string,
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  surface: string,
  city: string,
  state: string,
  score = 85
): RankedDiscoveryItem {
  return {
    item: {
      id,
      title,
      dek: `${title} — local favorite`,
      category,
      family: category === "restaurants" || category === "coffee" ? "food_drink" : "experience",
      place: { city, state, region: state },
      source: { name: "Kindred", tier: "local" },
      tags: ["local_place"],
      lat: 33.3,
      lon: -111.7,
    },
    score,
    reasons: [{ code: "local", label: "Verified local listing", weight: 1 }],
    surfaces: [surface as RankedDiscoveryItem["surfaces"][number]],
  };
}

function buildDiscovery(spec: Phase4CitySpec): DiscoveryPayload {
  const museum = ranked(
    `${spec.expectedMetroKey}-museum`,
    `${spec.label} Art Museum`,
    "museums",
    "museums",
    spec.city,
    spec.state
  );
  const hike = ranked(
    `${spec.expectedMetroKey}-hike`,
    `${spec.label} River Trail`,
    "hiking",
    "hiking",
    spec.city,
    spec.state
  );
  const coffee = ranked(
    `${spec.expectedMetroKey}-coffee`,
    `${spec.label} Neighborhood Coffee`,
    "coffee",
    "coffee",
    spec.city,
    spec.state
  );
  const restaurant = ranked(
    `${spec.expectedMetroKey}-restaurant`,
    `${spec.label} Table & Market`,
    "restaurants",
    "restaurants",
    spec.city,
    spec.state
  );

  return {
    version: 1,
    generatedAt: `${EDITION_DATE}T08:00:00.000Z`,
    editionDate: EDITION_DATE,
    location: {
      city: spec.city,
      region: spec.state,
      state: spec.state,
      lat: spec.lat,
      lon: spec.lon,
    },
    surfaces: {
      museums: {
        surface: "museums",
        headline: "Museums",
        editorNote: "",
        items: [museum],
      },
      hiking: {
        surface: "hiking",
        headline: "Hiking",
        editorNote: "",
        items: [hike],
      },
      coffee: {
        surface: "coffee",
        headline: "Coffee",
        editorNote: "",
        items: [coffee],
      },
      restaurants: {
        surface: "restaurants",
        headline: "Restaurants",
        editorNote: "",
        items: [restaurant],
      },
    },
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: 4,
      selectedCount: 4,
      editorNotes: [],
    },
  };
}

function buildSections(spec: Phase4CitySpec): EditionSection[] {
  const events = [
    {
      name: `${spec.label} Summer Concert`,
      city: spec.city,
      venue: `${spec.label} Community Park`,
      startDate: `${EDITION_DATE}T19:00:00`,
      lat: spec.lat,
      lon: spec.lon,
    },
    {
      name: `${spec.label} Farmers Market`,
      city: spec.city,
      venue: "Downtown",
      startDate: `${EDITION_DATE}T08:00:00`,
      lat: spec.lat + 0.01,
      lon: spec.lon + 0.01,
    },
  ];

  return [
    {
      id: `${spec.expectedMetroKey}-greeting`,
      section_type: "greeting",
      position: 0,
      headline: `Good morning, ${spec.city}`,
      body: `Here's your Kindred edition for ${spec.city}, ${spec.state}.`,
      source_note: null,
    },
    {
      id: `${spec.expectedMetroKey}-weather`,
      section_type: "weather",
      position: 1,
      headline: `${spec.label} weather today`,
      body: `Expect a clear morning in ${spec.city} with comfortable afternoon temperatures.`,
      source_note: null,
    },
    {
      id: `${spec.expectedMetroKey}-events`,
      section_type: "local_events",
      position: 2,
      headline: "Local Events",
      body: JSON.stringify({ events }),
      source_note: null,
    },
    {
      id: `${spec.expectedMetroKey}-story`,
      section_type: "story_of",
      position: 3,
      headline: `The Story of ${spec.city}`,
      body: `${spec.city} carries a distinct local character shaped by its neighborhoods, history, and the daily rhythm of ${spec.region}.`,
      source_note: JSON.stringify({ kind: "story_of", metroKey: spec.expectedMetroKey }),
    },
    {
      id: `${spec.expectedMetroKey}-history`,
      section_type: "today_in_history",
      position: 4,
      headline: "1969 — One Small Step on the Moon",
      body: "On this day, Apollo 11 astronauts continued their historic mission as the world watched the first human steps on the lunar surface.",
      source_note: null,
    },
  ];
}

function buildLeadStory(spec: Phase4CitySpec): LeadStory {
  return {
    id: `${spec.expectedMetroKey}-lead`,
    headline: `${spec.city} council approves downtown park expansion`,
    summary:
      "City leaders voted unanimously to fund new green space and pedestrian paths downtown.",
    body: [
      "City leaders voted unanimously to fund new green space and pedestrian paths, extending a riverfront trail that has become a weekend destination for families.",
    ],
    source: `${spec.city} Herald`,
    url: "https://example.com/local",
    publishedAt: `${EDITION_DATE}T06:00:00.000Z`,
    role: "local",
    contentType: "local_news",
    heroImage: {
      uri: `https://cdn.kindred.test/local/${spec.expectedMetroKey}-park.jpg`,
      alt: `${spec.city} park`,
      source: "article",
    },
    banditsPick: { reserved: true, isBanditsPick: false },
    selection: {
      score: 92,
      reasons: [{ code: "local", label: "Verified local lead", weight: 1 }],
      belowFoldTitles: [],
      strategy: "prefer_local",
    },
  };
}

export function buildPhase4FixtureEdition(spec: Phase4CitySpec): Phase4EditionInput {
  const discovery = buildDiscovery(spec);
  return {
    spec,
    editionDate: EDITION_DATE,
    metroKey: spec.expectedMetroKey,
    editionId: `fixture-${spec.expectedMetroKey}`,
    sections: buildSections(spec),
    leadStory: buildLeadStory(spec),
    nationalNews: SHARED_NATIONAL_NEWS,
    bandit: null,
    intelligence: {
      discovery,
      knowledge: null,
      memory: null,
      morning: null,
      morningOpening: null,
      morningBriefing: null,
      morningHero: SHARED_MASTERPIECE,
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
    morningHero: SHARED_MASTERPIECE,
    usNationalDailyId: SHARED_NATIONAL_ID,
    discovery,
    pipeline: {
      generationMs: 45_000,
      validationMs: 1200,
      repairMs: 0,
      publishMs: 400,
      validationStatus: "PASS",
      repairStagesRequeued: [],
      fullEditionRegeneration: false,
    },
  };
}

export function buildAllPhase4FixtureEditions(): Phase4EditionInput[] {
  return PHASE4_QA_CITIES.map(buildPhase4FixtureEdition);
}

/** Edition with intentional bleed for negative testing. */
export function buildBleedFixtureEdition(): Phase4EditionInput {
  const base = buildPhase4FixtureEdition(PHASE4_QA_CITIES[0]);
  return {
    ...base,
    sections: base.sections.map((s) =>
      s.section_type === "weather"
        ? { ...s, body: "Clear skies near the Space Needle today." }
        : s
    ),
  };
}

export { EDITION_DATE as PHASE4_FIXTURE_EDITION_DATE };
