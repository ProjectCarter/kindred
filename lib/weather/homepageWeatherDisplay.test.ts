import test from "node:test";
import assert from "node:assert/strict";
import { resolveHomepageWeatherDisplay } from "./homepageWeatherDisplay.ts";

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

test("resolveHomepageWeatherDisplay parses naturalized morning beat", () => {
  const display = resolveHomepageWeatherDisplay({
    morningWeatherBeat:
      "Expect a high near 106°F and a low near 84°F in Gilbert today, with plenty of sunshine.",
  });

  assert.ok(display);
  assert.equal(display.current, "106°");
  assert.equal(display.highLow, "High 106° · Low 84°");
  assert.equal(display.condition.label, "Clear skies");
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

test("resolveHomepageWeatherDisplay falls back to hero tag temp", () => {
  const display = resolveHomepageWeatherDisplay({
    weatherSectionHeadline: "Clear skies • 103°",
  });

  assert.ok(display);
  assert.equal(display.current, "103°");
  assert.equal(display.condition.label, "Clear skies");
});
