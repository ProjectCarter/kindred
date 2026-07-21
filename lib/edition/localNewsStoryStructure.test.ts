/**
 * Local News story classification — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_NEWS_STORY_STRUCTURES,
  localNewsModulesFromDesk,
  resolveLocalNewsStoryType,
} from "./localNewsStoryStructure.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("resolves known story types and defaults to general", () => {
  assert.equal(resolveLocalNewsStoryType("sports"), "sports");
  assert.equal(resolveLocalNewsStoryType("local_government"), "local_government");
  assert.equal(resolveLocalNewsStoryType("unknown"), "general");
});

test("sports desk uses fan-focused section labels", () => {
  const modules = localNewsModulesFromDesk({
    storyType: "sports",
    fieldAnswers: {
      why_it_matters: "The Cardinals enter camp with a new starting quarterback.",
      background: "Arizona has missed the playoffs in each of the last three seasons.",
      looking_ahead: "The first preseason game is scheduled for next Saturday.",
    },
  });
  assert.equal(modules.length, 3);
  assert.equal(modules[0]?.label, "WHY IT MATTERS");
  assert.equal(modules[1]?.label, "PLAYER & TEAM BACKGROUND");
  assert.equal(modules[2]?.label, "WHAT TO WATCH NEXT");
});

test("business desk includes economic impact section", () => {
  const modules = localNewsModulesFromDesk({
    storyType: "business",
    fieldAnswers: {
      background: "The retailer has operated in the valley since 1998.",
      economic_impact: "The closure affects roughly 120 local jobs.",
      looking_ahead: "Liquidation sales are expected to begin Friday.",
    },
  });
  assert.equal(modules[1]?.label, "ECONOMIC IMPACT");
});

test("story editor constitution classifies before writing", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/storyEditor/constitutions.ts"
    ),
    "utf8"
  );
  assert.match(source, /CLASSIFY FIRST/);
  assert.match(source, /localNewsStructureDigest/);
  assert.match(source, /THIN SOURCES/);
  assert.doesNotMatch(source, /6–10 paragraphs/);
});

test("every story type defines a lead goal and sections", () => {
  for (const structure of Object.values(LOCAL_NEWS_STORY_STRUCTURES)) {
    assert.ok(structure.leadGoal.length > 12);
    assert.ok(structure.sections.length >= 3);
  }
});
