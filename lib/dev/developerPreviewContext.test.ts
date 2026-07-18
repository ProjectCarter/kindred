import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { displayCityForEdition } from "./developerPreviewContext.ts";

describe("displayCityForEdition", () => {
  it("prefers developer preview city", () => {
    assert.equal(
      displayCityForEdition({
        preview: {
          editionId: "abc",
          metroKey: "seattle-wa",
          city: "Seattle",
          state: "WA",
          region: "WA",
          lat: 47.6,
          lon: -122.3,
          editionDate: "2026-07-17",
          isDeveloperPreview: true,
        },
        discoveryCity: "Gilbert",
        activeCity: "Gilbert",
      }),
      "Seattle"
    );
  });
});
