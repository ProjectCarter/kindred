import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canRecoverLocalEventsForMetro } from "./editionIdentity.ts";

describe("canRecoverLocalEventsForMetro", () => {
  it("rejects Gilbert place when Seattle metro is expected", () => {
    assert.equal(
      canRecoverLocalEventsForMetro({
        place: {
          city: "Gilbert",
          state: "AZ",
          region: "AZ",
          lat: 33.3,
          lon: -111.7,
        },
        expectedMetroKey: "seattle-wa",
      }),
      false
    );
  });

  it("allows Seattle place when Seattle metro is expected", () => {
    assert.equal(
      canRecoverLocalEventsForMetro({
        place: {
          city: "Seattle",
          state: "WA",
          region: "WA",
          lat: 47.6,
          lon: -122.3,
        },
        expectedMetroKey: "seattle-wa",
        cachedMetroKey: "seattle-wa",
      }),
      true
    );
  });
});
