import { assertEquals } from "jsr:@std/assert";
import { buildEditionHealthReport, healthScoreEmoji } from "./editionHealthReport.ts";
import type { CachedEditionBundle } from "../edition/editionCache.ts";
import type { DevEditionDiagnostics } from "./editionOverrideTypes.ts";

function emptyDiagnostics(overrides: Partial<DevEditionDiagnostics> = {}): DevEditionDiagnostics {
  return {
    city: "Gilbert",
    country: "United States",
    state: "Arizona",
    coordinates: { lat: 33.35, lon: -111.79 },
    metroId: "phoenix-metro",
    timeZone: "America/Phoenix",
    localDate: "2026-07-17",
    editionDate: "2026-07-17",
    editionGeneratedAt: "2026-07-17T12:00:00.000Z",
    cacheStatus: "network",
    radiusMiles: 25,
    totalEvents: 0,
    sportsEvents: 0,
    activities: 0,
    restaurants: 0,
    newsStories: 0,
    historicalArticles: 0,
    generationTimeMs: 5000,
    apiErrors: [],
    ...overrides,
  };
}

function minimalBundle(overrides: Partial<CachedEditionBundle> = {}): CachedEditionBundle {
  return {
    userId: "user-1",
    editionId: "edition-1",
    editionDate: "2026-07-17",
    metroKey: "gilbert-az",
    cachedAt: Date.now(),
    sections: [
      { section_type: "local_events", title: "Local Events", body: "[]" },
      { section_type: "today_in_history", title: "Today in History", body: "" },
    ],
    leadStory: null,
    topStories: [],
    bandit: null,
    intelligence: null,
    ...overrides,
  };
}

Deno.test("buildEditionHealthReport returns nine section scores", () => {
  const report = buildEditionHealthReport({
    bundle: minimalBundle(),
    diagnostics: emptyDiagnostics(),
    place: { city: "Gilbert", state: "Arizona", lat: 33.35, lon: -111.79 },
  });

  assertEquals(report.sections.length, 9);
  assertEquals(report.overallScore >= 0 && report.overallScore <= 100, true);
});

Deno.test("buildEditionHealthReport flags empty local events", () => {
  const report = buildEditionHealthReport({
    bundle: minimalBundle(),
    diagnostics: emptyDiagnostics(),
    place: { city: "Gilbert", state: "Arizona", lat: 33.35, lon: -111.79 },
  });

  const events = report.sections.find((s) => s.id === "local_events");
  assertEquals(events?.itemCount, 0);
  assertEquals(
    report.warnings.some((w) => w.message.includes("Local Events section is empty")),
    true
  );
});

Deno.test("healthScoreEmoji maps score bands", () => {
  assertEquals(healthScoreEmoji(90), "🟢");
  assertEquals(healthScoreEmoji(65), "🟡");
  assertEquals(healthScoreEmoji(40), "🔴");
});

Deno.test("buildEditionHealthReport flags slow generation", () => {
  const report = buildEditionHealthReport({
    bundle: minimalBundle(),
    diagnostics: emptyDiagnostics({ generationTimeMs: 130_000 }),
    place: { city: "Gilbert", state: "Arizona", lat: 33.35, lon: -111.79 },
  });

  assertEquals(
    report.warnings.some((w) => w.id === "generation_very_slow"),
    true
  );
});
