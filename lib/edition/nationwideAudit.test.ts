import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitySnapshot,
  detectCityBleed,
  extractNationalFingerprint,
  NATIONWIDE_AUDIT_CITIES,
  summarizePerformance,
  verifyLocalDistinct,
  verifyNationalParity,
  type CityEditionSnapshot,
} from "./nationwideAudit.ts";

const SHARED_NATIONAL = {
  us_national_daily_id: "national-uuid-1",
  morning_edition: { morningHero: { artworkId: "art-shared" } },
  national_news: {
    packageId: "national-uuid-1",
    stories: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
  },
};

const SHARED_HISTORY = {
  section_type: "today_in_history",
  headline: "1969 — One Small Step on the Moon",
  body: "Verified body.",
};

function snapshotFor(label: string, metroKey: string, localOverrides: Record<string, unknown>) {
  const spec = NATIONWIDE_AUDIT_CITIES.find((c) => c.label === label)!;
  return buildCitySnapshot(
    spec,
    {
      id: `ed-${metroKey}`,
      metro_key: metroKey,
      ...SHARED_NATIONAL,
      lead_story: { headline: `${label} local lead`, role: "local" },
      editorial_context: {
        sections: [
          {
            sectionType: "top_stories",
            items: [{ id: "l1", title: `${label} wire`, role: "local" }],
          },
        ],
      },
      bandit: { pick: { story: { headline: `${label} pick` } } },
      discovery: {
        surfaces: {
          museums: { items: [{ name: `${label} Museum` }] },
          restaurants: { items: [{ name: `${label} Eatery` }] },
        },
      },
      ...localOverrides,
    },
    [
      SHARED_HISTORY,
      { section_type: "weather", headline: `${label} weather`, body: `${label} forecast` },
      { section_type: "story_of", headline: `The Story of ${label}` },
      {
        section_type: "local_events",
        body: JSON.stringify({ events: [{ name: `${label} Festival`, city: label }] }),
      },
    ]
  );
}

test("national fingerprints match across Seattle and Phoenix snapshots", () => {
  const seattle = snapshotFor("Seattle", "seattle-wa", {});
  const phoenix = snapshotFor("Phoenix", "phoenix-az", {});
  const issues = verifyNationalParity([seattle, phoenix]);
  assert.equal(issues.length, 0);
  assert.equal(seattle.national.masterpieceArtworkId, phoenix.national.masterpieceArtworkId);
  assert.equal(seattle.national.nationalNewsPackageId, phoenix.national.nationalNewsPackageId);
});

test("local desks differ between cities", () => {
  const seattle = snapshotFor("Seattle", "seattle-wa", {});
  const chicago = snapshotFor("Chicago", "chicago-il", {});
  const issues = verifyLocalDistinct([seattle, chicago]);
  assert.equal(issues.length, 0);
  assert.notEqual(seattle.localSerialized, chicago.localSerialized);
});

test("detectCityBleed flags Gilbert in Seattle content", () => {
  const seattle = NATIONWIDE_AUDIT_CITIES.find((c) => c.label === "Seattle")!;
  const issues = detectCityBleed(seattle, "Events in Gilbert this weekend");
  assert.ok(issues.some((i) => i.category === "cross_city_bleed"));
});

test("extractNationalFingerprint reads masterpiece, history, and national news", () => {
  const fp = extractNationalFingerprint(
    {
      us_national_daily_id: "x",
      morning_edition: { morningHero: { artworkId: "art-1" } },
      national_news: { packageId: "x", stories: [{ id: "a" }] },
    },
    [SHARED_HISTORY]
  );
  assert.equal(fp.masterpieceArtworkId, "art-1");
  assert.equal(fp.historyHeadline, SHARED_HISTORY.headline);
  assert.deepEqual(fp.nationalNewsStoryIds, ["a"]);
});

test("summarizePerformance identifies fastest and slowest", () => {
  const summary = summarizePerformance([
    {
      label: "Seattle",
      passed: true,
      issues: [],
      timing: {
        buildStartMs: 0,
        enqueueMs: 500,
        workerStartMs: 2000,
        firstPaintMs: 45000,
        readyMs: 120000,
        totalMs: 120000,
        nationalCacheLikely: false,
      },
    },
    {
      label: "San Diego",
      passed: true,
      issues: [],
      timing: {
        buildStartMs: 0,
        enqueueMs: 400,
        workerStartMs: 1500,
        firstPaintMs: 8000,
        readyMs: 45000,
        totalMs: 45000,
        nationalCacheLikely: true,
      },
    },
  ]);
  assert.equal(summary.fastest, "San Diego");
  assert.equal(summary.slowest, "Seattle");
  assert.ok(summary.averageTotalMs > 0);
});

test("national mismatch detected when history differs", () => {
  const a: CityEditionSnapshot = snapshotFor("Seattle", "seattle-wa", {});
  const b: CityEditionSnapshot = snapshotFor("Chicago", "chicago-il", {});
  b.national.historyHeadline = "Different history";
  const issues = verifyNationalParity([a, b]);
  assert.ok(issues.some((i) => i.category === "national_history_mismatch"));
});
