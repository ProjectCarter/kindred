import test from "node:test";
import assert from "node:assert/strict";
import { resolveHomepageWeatherDisplay } from "./homepageWeatherDisplay.ts";
import { isWeatherStale, EDITION_WEATHER_MAX_AGE_MS } from "./weatherFreshness.ts";

test("resolveHomepageWeatherDisplay parses deterministic weather summary", () => {
  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 102°F in Gilbert; high 106°F / low 84°F; plenty of sunshine.",
    },
  });

  assert.ok(display);
  assert.equal(display.current, "102°");
  assert.equal(display.highLow, "High 106° · Low 84°");
  assert.equal(display.condition.label, "Clear skies");
  assert.equal(display.condition.emoji, "☀️");
});

test("live weather summary takes priority over edition snapshot", () => {
  const display = resolveHomepageWeatherDisplay({
    liveWeatherSummary:
      "Current 96°F in Gilbert; high 98°F / low 81°F; overcast skies.",
    liveWeatherRetrievedAt: new Date().toISOString(),
    editorialContext: {
      weatherSummary:
        "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies.",
    },
  });

  assert.ok(display);
  assert.equal(display.current, "96°");
  assert.equal(display.highLow, "High 98° · Low 81°");
});

test("stale edition weather is rejected without live refresh", () => {
  const staleAt = new Date(Date.now() - EDITION_WEATHER_MAX_AGE_MS - 60_000).toISOString();
  assert.equal(isWeatherStale(staleAt), true);

  const display = resolveHomepageWeatherDisplay({
    editorialContext: {
      weatherSummary:
        "Current 88°F in Gilbert; high 103°F / low 82°F; overcast skies.",
    },
    editionWeatherRetrievedAt: staleAt,
  });

  assert.equal(display, null);
});

test("resolveHomepageWeatherDisplay omits cleanly when data is missing", () => {
  assert.equal(resolveHomepageWeatherDisplay({}), null);
  assert.equal(
    resolveHomepageWeatherDisplay({
      weatherSectionHeadline: "Weather",
    }),
    null
  );
});

test("resolveHomepageWeatherDisplay does not treat forecast high as current", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSectionHeadline: "Clear skies • 103°",
  });

  assert.equal(display, null);
});

test("morning beat without current temperature does not invent a current reading", () => {
  const display = resolveHomepageWeatherDisplay({
    morningWeatherBeat:
      "Expect a high near 106°F and a low near 84°F in Gilbert today, with plenty of sunshine.",
  });

  assert.equal(display, null);
});
