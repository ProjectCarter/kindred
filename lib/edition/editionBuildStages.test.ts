import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITION_BUILD_STAGES,
  OPTIONAL_EDITION_BUILD_STAGES,
  isStageComplete,
  nextEditionBuildStage,
  parseEditionBuildStage,
  stageIndex,
} from "./editionBuildStages.ts";

test("EDITION_BUILD_STAGES — eleven ordered stages ending in finalize", () => {
  assert.equal(EDITION_BUILD_STAGES.length, 11);
  assert.equal(EDITION_BUILD_STAGES[0], "initialize_edition");
  assert.equal(EDITION_BUILD_STAGES[1], "generate_national_daily");
  assert.equal(EDITION_BUILD_STAGES[2], "attach_national_daily");
  assert.equal(EDITION_BUILD_STAGES.at(-1), "finalize_edition");
});

test("nextEditionBuildStage — walks pipeline then returns null", () => {
  assert.equal(nextEditionBuildStage(null), "initialize_edition");
  assert.equal(nextEditionBuildStage("initialize_edition"), "generate_national_daily");
  assert.equal(nextEditionBuildStage("generate_national_daily"), "attach_national_daily");
  assert.equal(nextEditionBuildStage("local_news"), "bandits_pick");
  assert.equal(nextEditionBuildStage("finalize_edition"), null);
});

test("local_news runs before bandits_pick for editorial dependency", () => {
  assert.ok(stageIndex("local_news") < stageIndex("bandits_pick"));
});

test("OPTIONAL_EDITION_BUILD_STAGES — optional desks only", () => {
  for (const stage of OPTIONAL_EDITION_BUILD_STAGES) {
    assert.notEqual(stage, "initialize_edition");
    assert.notEqual(stage, "generate_national_daily");
    assert.notEqual(stage, "finalize_edition");
    assert.notEqual(stage, "attach_national_daily");
    assert.notEqual(stage, "weather");
    assert.notEqual(stage, "local_events");
    assert.notEqual(stage, "story_of");
  }
  assert.equal(OPTIONAL_EDITION_BUILD_STAGES.size, 4);
});

test("isStageComplete — tracks completed stage names", () => {
  const done = ["initialize_edition", "generate_national_daily", "attach_national_daily"];
  assert.equal(isStageComplete(done, "initialize_edition"), true);
  assert.equal(isStageComplete(done, "weather"), false);
  assert.equal(isStageComplete(null, "weather"), false);
});

test("parseEditionBuildStage — rejects unknown values", () => {
  assert.equal(parseEditionBuildStage("weather"), "weather");
  assert.equal(parseEditionBuildStage("not_a_stage"), null);
  assert.equal(parseEditionBuildStage(""), null);
});
