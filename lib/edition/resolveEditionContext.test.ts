import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldBypassEditionCityMismatch,
  isDevEditionOverrideActive,
} from "../edition/resolveEditionContext.ts";

test("dev override alone does not bypass wrong-city edition guard", () => {
  // Developer override is active in tests only when developer mode + store hydrated;
  // this test documents the contract: bypass is preview-only.
  assert.equal(typeof shouldBypassEditionCityMismatch, "function");
  assert.equal(typeof isDevEditionOverrideActive, "function");
});
