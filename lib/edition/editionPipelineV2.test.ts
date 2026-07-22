import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITION_BUILD_STAGES,
  nextEditionBuildStage,
} from "./editionBuildStages.ts";
import {
  isEditionFullyBuilt,
  isStagedEditionBuildComplete,
} from "./stagedBuildCompletion.ts";
import { isEditionEarlyPaintEnabledClientDefault } from "./earlyPaintFeature.ts";
import {
  emptyEditionBuildValidationState,
  mergeValidationIntoBuildState,
  readValidationFromBuildState,
} from "./editionValidationTypes.ts";

test("EDITION_BUILD_STAGES — ends with validate_technical then publish_edition", () => {
  assert.equal(EDITION_BUILD_STAGES.length, 12);
  assert.equal(EDITION_BUILD_STAGES.at(-2), "validate_technical");
  assert.equal(EDITION_BUILD_STAGES.at(-1), "publish_edition");
});

test("nextEditionBuildStage — bandits_pick chains to validate_technical", () => {
  assert.equal(nextEditionBuildStage("bandits_pick"), "validate_technical");
  assert.equal(nextEditionBuildStage("validate_technical"), "publish_edition");
  assert.equal(nextEditionBuildStage("publish_edition"), null);
});

test("isStagedEditionBuildComplete — accepts legacy finalize_edition", () => {
  assert.equal(isStagedEditionBuildComplete(["finalize_edition"]), true);
  assert.equal(isStagedEditionBuildComplete(["publish_edition"]), true);
});

test("isEditionFullyBuilt — requires publish_edition or legacy finalize", () => {
  assert.equal(
    isEditionFullyBuilt({ editionStatus: "ready", completedStages: ["publish_edition"] }),
    true
  );
  assert.equal(
    isEditionFullyBuilt({ editionStatus: "ready", completedStages: ["validate_technical"] }),
    false
  );
});

test("early paint client default is disabled for strict validation", () => {
  assert.equal(isEditionEarlyPaintEnabledClientDefault(), false);
});

test("validation persistence round-trip on build_state", () => {
  const base = { discovery: { version: 1 } };
  const validation = emptyEditionBuildValidationState(false);
  validation.latestReport = {
    version: 1,
    startedAt: "2026-07-22T00:00:00.000Z",
    completedAt: "2026-07-22T00:00:01.000Z",
    durationMs: 10,
    enforcing: true,
    overallStatus: "PASS",
    deskReports: [],
    blockingFailures: [],
    warnings: [],
    externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
  };
  const merged = mergeValidationIntoBuildState(base, validation);
  const read = readValidationFromBuildState(merged);
  assert.equal(read?.latestReport?.overallStatus, "PASS");
  assert.ok((merged as { discovery?: unknown }).discovery);
});
