import assert from "node:assert/strict";
import test from "node:test";
import { composeWeatherGuidance } from "./weatherGuidance.ts";
import { parseWeatherSummaryText } from "./parseWeatherSummary.ts";

test("composeWeatherGuidance uses extreme heat copy from verified high", () => {
  const parsed = parseWeatherSummaryText(
    "Current 88°F in Gilbert; high 104°F / low 82°F; plenty of sunshine."
  );
  const note = composeWeatherGuidance({
    parsed,
    snapshot: {
      retrievedAt: new Date().toISOString(),
      conditionCode: 0,
      currentTempC: 31,
      highTempC: 40,
      lowTempC: 28,
      windSpeedMs: 2,
      unit: "fahrenheit",
      alerts: [],
      guidanceNote: null,
    },
  });

  assert.ok(note);
  assert.match(note!, /104°/);
  assert.match(note!, /dangerous afternoon heat/i);
  assert.doesNotMatch(note!, /coffee shops/i);
});

test("composeWeatherGuidance prefers persisted guidance", () => {
  const note = composeWeatherGuidance({
    persistedGuidance:
      "Scattered afternoon showers are expected. Keep an umbrella nearby.",
    parsed: parseWeatherSummaryText(
      "Current 72°F in Seattle; high 74°F / low 58°F; rain likely."
    ),
  });

  assert.equal(
    note,
    "Scattered afternoon showers are expected. Keep an umbrella nearby."
  );
});

test("composeWeatherGuidance returns null without enough data", () => {
  assert.equal(composeWeatherGuidance({ parsed: null, snapshot: null }), null);
});

test("composeWeatherGuidance omits invented storm language for cloudy skies", () => {
  const note = composeWeatherGuidance({
    parsed: parseWeatherSummaryText(
      "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies."
    ),
    snapshot: {
      retrievedAt: new Date().toISOString(),
      conditionCode: 3,
      currentTempC: 31,
      highTempC: 39.4,
      lowTempC: 27.8,
      windSpeedMs: 2,
      unit: "fahrenheit",
      alerts: [],
      guidanceNote: null,
    },
  });

  assert.ok(note);
  assert.doesNotMatch(note!, /storm/i);
});
