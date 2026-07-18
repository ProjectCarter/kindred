import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalMetroKeyFromLocation,
  legacyMetroKeyFromLocation,
  libraryMetroKeysForLocation,
  storyOfMetroKeysForLocation,
} from "./libraryMetroKeys.ts";

const GILBERT = {
  city: "Gilbert",
  state: "AZ",
  lat: 33.3528,
  lon: -111.789,
};

const SEATTLE = {
  city: "Seattle",
  state: "WA",
  lat: 47.6062,
  lon: -122.3321,
};

test("Gilbert legacy slug differs from canonical market key", () => {
  assert.equal(legacyMetroKeyFromLocation(GILBERT), "gilbert-az");
  assert.equal(canonicalMetroKeyFromLocation(GILBERT), "phoenix-az");
  assert.deepEqual(libraryMetroKeysForLocation(GILBERT), [
    "phoenix-az",
    "gilbert-az",
  ]);
  assert.deepEqual(storyOfMetroKeysForLocation(GILBERT), [
    "gilbert-az",
    "phoenix-az",
  ]);
});

test("Seattle legacy and canonical keys match", () => {
  assert.equal(legacyMetroKeyFromLocation(SEATTLE), "seattle-wa");
  assert.equal(canonicalMetroKeyFromLocation(SEATTLE), "seattle-wa");
  assert.deepEqual(libraryMetroKeysForLocation(SEATTLE), ["seattle-wa"]);
});

test("libraryMetroKeys falls back to legacy when coords missing", () => {
  assert.deepEqual(
    libraryMetroKeysForLocation({
      city: "Gilbert",
      state: "AZ",
      lat: NaN,
      lon: NaN,
    }),
    ["gilbert-az"]
  );
});
