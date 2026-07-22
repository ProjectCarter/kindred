import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKING_PUBLICATION_DESKS,
  NON_BLOCKING_PUBLICATION_DESKS,
  WARNING_PUBLICATION_DESKS,
  deskStatusForPublicationIssues,
  isBlockingPublicationDesk,
  recordDeskPublicationOutcome,
} from "./publicationSeverity.ts";

test("V1 blocking desks — core discovery only", () => {
  assert.deepEqual([...BLOCKING_PUBLICATION_DESKS].sort(), [
    "activities",
    "food_drinks",
    "local_events",
  ]);
});

test("V1 warning desks — publish allowed on partial content", () => {
  assert.deepEqual([...WARNING_PUBLICATION_DESKS].sort(), [
    "local_news",
    "national_news",
    "story_of",
    "weather",
  ]);
});

test("V1 non-blocking desks — delight sections never block publish", () => {
  assert.deepEqual([...NON_BLOCKING_PUBLICATION_DESKS].sort(), [
    "bandits_pick",
    "history_around_town",
    "masterpiece",
    "today_in_history",
  ]);
});

test("recordDeskPublicationOutcome — warning desk never adds blockingFailures", () => {
  const blockingFailures: string[] = [];
  const warnings: string[] = [];
  const status = recordDeskPublicationOutcome({
    desk: "weather",
    status: "FAIL",
    reasons: ["empty_weather_section"],
    blockingFailures,
    warnings,
  });
  assert.equal(status, "WARNING");
  assert.equal(blockingFailures.length, 0);
  assert.equal(warnings.includes("weather:empty_weather_section"), true);
});

test("recordDeskPublicationOutcome — core desk FAIL blocks publish", () => {
  const blockingFailures: string[] = [];
  const warnings: string[] = [];
  const status = recordDeskPublicationOutcome({
    desk: "local_events",
    status: "FAIL",
    reasons: ["no_events"],
    blockingFailures,
    warnings,
  });
  assert.equal(status, "FAIL");
  assert.equal(blockingFailures.includes("local_events:no_events"), true);
});

test("deskStatusForPublicationIssues — maps by severity tier", () => {
  assert.equal(isBlockingPublicationDesk("food_drinks"), true);
  assert.equal(deskStatusForPublicationIssues("weather", true), "WARNING");
  assert.equal(deskStatusForPublicationIssues("local_events", true), "FAIL");
  assert.equal(deskStatusForPublicationIssues("masterpiece", true), "WARNING");
});
