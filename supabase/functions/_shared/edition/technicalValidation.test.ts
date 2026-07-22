import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { DiscoveryPayload, RankedDiscoveryItem } from "../discovery/types.ts";
import type { LeadStory } from "../leadStory/types.ts";
import {
  isPublicationEligible,
  runTechnicalValidationOnSnapshot,
  type EditionValidationSnapshot,
} from "./technicalValidation.ts";

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
      family: category === "activities" ? "experience" : "food_drink",
      tags: [],
      source: { name: "Verified Source", tier: "local" },
      url: "https://example.com/place",
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

function sampleDiscovery(): DiscoveryPayload {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate: "2026-08-01",
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
        items: [ranked("act-1", "activities"), ranked("act-2", "activities")],
      },
      coffee: {
        surface: "coffee",
        headline: "Coffee",
        editorNote: "",
        items: [ranked("food-1", "coffee"), ranked("food-2", "coffee")],
      },
    },
    picks: [],
    editorBrief: "",
    selectionMeta: {
      candidateCount: 4,
      selectedCount: 4,
      editorNotes: [],
      enrichQueue: [],
    },
  };
}

/** Matches eventDateVerification.test baseEvent + six publishable editorial paragraphs. */
function publishableEventFixture(overrides: Record<string, unknown> = {}) {
  return {
    name: "Summer Concert in the Park",
    startDateTime: "Aug 15, 2026 · 7:00 PM",
    startDateIso: "2026-08-15",
    startTimeIso: "19:00",
    date: "Sat, Aug 15",
    time: "7 PM",
    venue: "Freestone Park",
    city: "Gilbert",
    sourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
    sourceName: "Eventbrite",
    sourceId: "eventbrite",
    sourceTier: "aggregator",
    dateSourceType: "official_ticketing_page",
    dateSourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
    officialWebsite: "https://www.gilbertaz.gov/events",
    lat: 33.35,
    lon: -111.79,
    editorialHeadline: "Freestone Park Welcomes Summer Under the Stars",
    banditNote:
      "Freestone Park hosts an open-air concert with room to spread out on the lawn.",
    editorialBody: [
      "Freestone Park fills with picnic blankets and low conversation before the band takes the stage.",
      "The summer concert series keeps the focus on acoustic sets and easy family pacing at Freestone Park.",
      "Tickets and gates remain on the official listing linked below for anyone planning ahead.",
      "Families often arrive early to claim shade near the amphitheater rim at Freestone Park.",
      "Local vendors set up along the walkway with cold drinks before the first chord rings out.",
      "Next time you drive past Freestone Park, remember the amphitheater was built for evenings exactly like this one.",
    ],
    ...overrides,
  };
}

const futureEventBody = JSON.stringify({
  events: [publishableEventFixture()],
});

function baseSnapshot(overrides: Partial<EditionValidationSnapshot> = {}): EditionValidationSnapshot {
  return {
    editionId: "edition-1",
    editionDate: "2026-08-01",
    metroKey: "gilbert_az",
    userId: "user-1",
    editionStatus: "processing",
    sections: [
      { section_type: "weather", headline: "Weather", body: "Sunny and warm today." },
      { section_type: "local_events", headline: "Events", body: futureEventBody },
      { section_type: "food_drinks", headline: "Food", body: '{"version":1,"items":[]}' },
      { section_type: "today_in_history", headline: "History", body: "On this day in 1969." },
      { section_type: "story_of", headline: "Story of Gilbert", body: "Gilbert began as a rail siding." },
    ],
    discovery: sampleDiscovery(),
    leadStory: {
      id: "lead-1",
      headline: "Council approves park improvements",
      summary: "Town leaders approved funding for neighborhood park upgrades this week.",
      source: "Local Source",
      url: "https://example.com/news",
      publishedAt: new Date().toISOString(),
      role: "local",
      contentType: "local_news",
      deskBadge: "📰 Local News",
      heroImage: { uri: null, alt: "", source: "none" },
      banditsPick: { reserved: true, isBanditsPick: false },
      selection: { score: 80, reasons: [], belowFoldTitles: [], strategy: "prefer_local" },
    } satisfies LeadStory,
    nationalNews: { stories: [{ headline: "National headline" }] },
    usNationalDailyId: "national-daily-1",
    morningEdition: {
      morningHero: {
        hostedUrl: "https://example.com/masterpiece.jpg",
        detail: {
          sections: [{ heading: "Overview", paragraphs: ["Verified overview copy for readers."] }],
          lookingCloser: ["Light falls from the left.", "The background recedes into shadow."],
          didYouKnow: "Painted in 1600.",
          museumName: "Museum",
          museumLocation: "City",
          officialMuseumUrl: "https://museum.example.com",
        },
      },
    },
    historyAroundTown: {
      places: [{ id: "hp-1", title: "Heritage Hall" }],
      carousel: [{ id: "c-1", title: "Water Tower" }],
    },
    bandit: null,
    editorialContext: { weatherSummary: "Sunny and warm today." },
    expectStoryOf: true,
    ...overrides,
  };
}

Deno.test("valid edition snapshot passes technical validation", async () => {
  const report = await runTechnicalValidationOnSnapshot({
    snapshot: baseSnapshot(),
    enforcing: true,
    editionDate: "2026-08-01",
    now: new Date("2026-07-22T12:00:00Z"),
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "PASS");
  assertEquals(isPublicationEligible(report), true);
});

Deno.test("missing local events fails validation", async () => {
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.filter((s) => s.section_type !== "local_events"),
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "FAIL");
  assertEquals(
    report.blockingFailures.some((f) => f.startsWith("local_events:")),
    true
  );
});

Deno.test("missing activities fails validation", async () => {
  const discovery = sampleDiscovery();
  discovery.surfaces.activities = { ...discovery.surfaces.activities!, items: [] };
  const report = await runTechnicalValidationOnSnapshot({
    snapshot: baseSnapshot({ discovery }),
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "FAIL");
});

Deno.test("missing food and drinks fails validation", async () => {
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.filter((s) => s.section_type !== "food_drinks"),
    discovery: sampleDiscovery(),
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "FAIL");
});

Deno.test("expired events fail validation", async () => {
  const expiredBody = JSON.stringify({
    events: [
      publishableEventFixture({
        name: "Past Concert at Freestone Park",
        startDateTime: "Jul 10, 2026 · 7:00 PM",
        startDateIso: "2026-07-10",
        startTimeIso: "19:00",
        editorialHeadline: "Freestone Park Concert Has Already Passed",
        editorialBody: [
          "Freestone Park hosted an evening concert that already ended before today's edition.",
          "The amphitheater at Freestone Park cleared out after the final encore last week.",
          "Ticket holders checked the official listing for start times at Freestone Park.",
          "Families who attended spread blankets along the lawn at Freestone Park.",
          "Vendors closed their booths once the stage lights dimmed at Freestone Park.",
          "Next time you drive past Freestone Park, remember concerts there follow a strict seasonal calendar.",
        ],
      }),
    ],
  });
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.map((s) =>
      s.section_type === "local_events" ? { ...s, body: expiredBody } : s
    ),
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    now: new Date("2026-07-22T12:00:00Z"),
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "FAIL");
});

Deno.test("duplicate events fail validation", async () => {
  const event = JSON.parse(futureEventBody).events[0];
  const duplicateBody = JSON.stringify({ events: [event, event] });
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.map((s) =>
      s.section_type === "local_events" ? { ...s, body: duplicateBody } : s
    ),
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    now: new Date("2026-07-22T12:00:00Z"),
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "FAIL");
});

Deno.test("empty weather warns but allows publication", async () => {
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.map((s) =>
      s.section_type === "weather" ? { ...s, body: "" } : s
    ),
    editorialContext: {},
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "WARNING");
  assertEquals(isPublicationEligible(report), true);
  assertEquals(report.blockingFailures.length, 0);
  const weather = report.deskReports.find((d) => d.desk === "weather");
  assertEquals(weather?.status, "WARNING");
});

Deno.test("disabled Bandit's Pick is SKIPPED not FAIL", async () => {
  const report = await runTechnicalValidationOnSnapshot({
    snapshot: baseSnapshot({ bandit: null }),
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  const bandit = report.deskReports.find((d) => d.desk === "bandits_pick");
  assertEquals(bandit?.status, "SKIPPED");
});

Deno.test("approved local news sports fallback may WARNING not FAIL", async () => {
  const lead = baseSnapshot().leadStory!;
  const snapshot = baseSnapshot({
    leadStory: {
      ...lead,
      contentType: "sports",
      deskBadge: "🏈 Sports",
      headline: "Diamondbacks win in extra innings",
      summary: "The home team closed a tight game after ten innings of play.",
    },
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  const desk = report.deskReports.find((d) => d.desk === "local_news");
  assertEquals(desk?.status === "PASS" || desk?.status === "WARNING", true);
  assertEquals(report.overallStatus === "PASS" || report.overallStatus === "WARNING", true);
});

Deno.test("missing national news warns but allows publication", async () => {
  const snapshot = baseSnapshot({
    usNationalDailyId: null,
    nationalNews: null,
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "WARNING");
  assertEquals(isPublicationEligible(report), true);
  assertEquals(report.blockingFailures.length, 0);
  const national = report.deskReports.find((d) => d.desk === "national_news");
  assertEquals(national?.status, "WARNING");
});

Deno.test("missing delight desks warn but allow publication", async () => {
  const snapshot = baseSnapshot({
    sections: baseSnapshot().sections.filter((s) => s.section_type !== "today_in_history"),
    morningEdition: null,
    historyAroundTown: null,
  });
  const report = await runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "WARNING");
  assertEquals(isPublicationEligible(report), true);
  assertEquals(report.blockingFailures.length, 0);
  assertEquals(
    report.deskReports.find((d) => d.desk === "today_in_history")?.status,
    "WARNING"
  );
  assertEquals(
    report.deskReports.find((d) => d.desk === "masterpiece")?.status,
    "WARNING"
  );
  assertEquals(
    report.deskReports.find((d) => d.desk === "history_around_town")?.status,
    "WARNING"
  );
});

Deno.test("missing local news lead warns but allows publication", async () => {
  const report = await runTechnicalValidationOnSnapshot({
    snapshot: baseSnapshot({ leadStory: null }),
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  assertEquals(report.overallStatus, "WARNING");
  assertEquals(isPublicationEligible(report), true);
  const desk = report.deskReports.find((d) => d.desk === "local_news");
  assertEquals(desk?.status, "WARNING");
});

Deno.test("publish eligibility rejects FAIL reports", () => {
  assertEquals(
    isPublicationEligible({
      version: 1,
      startedAt: "",
      completedAt: "",
      durationMs: 1,
      enforcing: true,
      overallStatus: "FAIL",
      deskReports: [],
      blockingFailures: ["local_events:no_events"],
      warnings: [],
      externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
    }),
    false
  );
});

Deno.test("validation completes under budget without external checks", async () => {
  const started = performance.now();
  await runTechnicalValidationOnSnapshot({
    snapshot: baseSnapshot(),
    enforcing: true,
    editionDate: "2026-08-01",
    skipExternalChecks: true,
  });
  const elapsed = performance.now() - started;
  if (elapsed > 5000) {
    throw new Error(`validation too slow: ${Math.round(elapsed)}ms`);
  }
});
