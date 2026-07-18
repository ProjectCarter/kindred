import test from "node:test";
import assert from "node:assert/strict";
import { shouldWithholdEditionForCityMismatch } from "./editionCityMismatch.ts";

test("Gilbert built city is not withheld when local_events majority is Phoenix", () => {
  assert.equal(
    shouldWithholdEditionForCityMismatch({
      activeCity: "Gilbert",
      builtCity: "Gilbert",
      sectionCity: "Phoenix",
      mode: "home",
    }),
    false
  );
});

test("wrong built city is still withheld", () => {
  assert.equal(
    shouldWithholdEditionForCityMismatch({
      activeCity: "Gilbert",
      builtCity: "Seattle",
      sectionCity: "Seattle",
      mode: "home",
    }),
    true
  );
});

test("unknown built city + Current Location withholds", () => {
  assert.equal(
    shouldWithholdEditionForCityMismatch({
      activeCity: "Gilbert",
      builtCity: null,
      sectionCity: null,
      mode: "current",
    }),
    true
  );
});

test("unknown built city + home mode uses section city fallback", () => {
  assert.equal(
    shouldWithholdEditionForCityMismatch({
      activeCity: "Gilbert",
      builtCity: null,
      sectionCity: "Phoenix",
      mode: "home",
    }),
    true
  );
  assert.equal(
    shouldWithholdEditionForCityMismatch({
      activeCity: "Gilbert",
      builtCity: null,
      sectionCity: "Gilbert",
      mode: "home",
    }),
    false
  );
});
