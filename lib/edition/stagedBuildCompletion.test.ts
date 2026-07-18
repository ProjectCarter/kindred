import test from "node:test";
import assert from "node:assert/strict";
import {
  editionNeedsStagedBuildResume,
  isEditionFullyBuilt,
  isStagedEditionBuildComplete,
} from "./stagedBuildCompletion.ts";

test("isStagedEditionBuildComplete — requires finalize_edition", () => {
  assert.equal(isStagedEditionBuildComplete(["initialize_edition"]), false);
  assert.equal(
    isStagedEditionBuildComplete([
      "initialize_edition",
      "attach_national_daily",
    ]),
    false
  );
  assert.equal(
    isStagedEditionBuildComplete([
      "initialize_edition",
      "attach_national_daily",
      "finalize_edition",
    ]),
    true
  );
});

test("editionNeedsStagedBuildResume — true after early MVP attach only", () => {
  assert.equal(
    editionNeedsStagedBuildResume({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "attach_national_daily"],
    }),
    true
  );
});

test("isEditionFullyBuilt — false when ready but stages incomplete", () => {
  assert.equal(
    isEditionFullyBuilt({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "attach_national_daily"],
    }),
    false
  );
  assert.equal(
    isEditionFullyBuilt({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "finalize_edition"],
    }),
    true
  );
});
