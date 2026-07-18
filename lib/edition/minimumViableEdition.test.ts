import test from "node:test";
import assert from "node:assert/strict";
import {
  assessMinimumViableEdition,
  isProcessingEditionPaintable,
} from "./minimumViableEdition.ts";

test("MVP — today_in_history alone is paintable", () => {
  const result = assessMinimumViableEdition([
    { section_type: "today_in_history" },
  ]);
  assert.equal(result.paintable, true);
});

test("MVP — empty sections are not paintable", () => {
  assert.equal(assessMinimumViableEdition([]).paintable, false);
});

test("MVP — greeting alone is not paintable", () => {
  assert.equal(
    assessMinimumViableEdition([{ section_type: "greeting" }]).paintable,
    false
  );
});

test("processing + core section is paintable", () => {
  assert.equal(
    isProcessingEditionPaintable("processing", [
      { section_type: "local_events" },
    ]),
    true
  );
});

test("ready requires at least one section", () => {
  assert.equal(isProcessingEditionPaintable("ready", []), false);
});
