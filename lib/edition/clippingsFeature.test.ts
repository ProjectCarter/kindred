import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIPPINGS_ENABLED,
  isClippingsEnabled,
  isPersonalLibraryEnabled,
  isPersonalLibrarySignalType,
  PERSONAL_LIBRARY_SIGNAL_TYPES,
} from "./clippingsFeature.ts";

describe("clippingsFeature (V1 personal library gate)", () => {
  it("CLIPPINGS_ENABLED is false for Version 1", () => {
    assert.equal(CLIPPINGS_ENABLED, false);
    assert.equal(isPersonalLibraryEnabled(), false);
    assert.equal(isClippingsEnabled(), false);
  });

  it("identifies personal-library reading signal types", () => {
    for (const signalType of PERSONAL_LIBRARY_SIGNAL_TYPES) {
      assert.equal(isPersonalLibrarySignalType(signalType), true);
    }
    assert.equal(isPersonalLibrarySignalType("open"), false);
    assert.equal(isPersonalLibrarySignalType("read_complete"), false);
  });
});
