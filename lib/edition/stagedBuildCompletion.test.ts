import test from "node:test";
import assert from "node:assert/strict";
import {
  editionNeedsStagedBuildResume,
  isEditionFullyBuilt,
  isStagedEditionBuildComplete,
} from "./stagedBuildCompletion.ts";

test("isStagedEditionBuildComplete — requires publish_edition or legacy finalize", () => {
  assert.equal(isStagedEditionBuildComplete(["initialize_edition"]), false);
  assert.equal(
    isStagedEditionBuildComplete([
      "initialize_edition",
      "generate_national_daily",
      "attach_national_daily",
    ]),
    false
  );
  assert.equal(
    isStagedEditionBuildComplete([
      "initialize_edition",
      "publish_edition",
    ]),
    true
  );
  assert.equal(
    isStagedEditionBuildComplete([
      "initialize_edition",
      "finalize_edition",
    ]),
    true
  );
});

test("editionNeedsStagedBuildResume — true after early MVP attach only", () => {
  assert.equal(
    editionNeedsStagedBuildResume({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "generate_national_daily", "attach_national_daily"],
    }),
    true
  );
});

test("isEditionFullyBuilt — false when ready but stages incomplete", () => {
  assert.equal(
    isEditionFullyBuilt({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "generate_national_daily", "attach_national_daily"],
    }),
    false
  );
  assert.equal(
    isEditionFullyBuilt({
      editionStatus: "ready",
      completedStages: ["initialize_edition", "publish_edition"],
    }),
    true
  );
});
