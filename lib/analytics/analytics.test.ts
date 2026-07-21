import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractDestinationDomain,
  sanitizeEventProperties,
} from "./sanitize.ts";
import { shouldEmitOnce, resetAnalyticsDedupe } from "./dedupe.ts";

describe("extractDestinationDomain", () => {
  it("returns hostname without query params", () => {
    assert.equal(
      extractDestinationDomain(
        "https://www.eventbrite.com/e/show?tickets=secret&foo=bar"
      ),
      "eventbrite.com"
    );
  });

  it("returns null for invalid urls", () => {
    assert.equal(extractDestinationDomain("not a url"), null);
  });
});

describe("sanitizeEventProperties", () => {
  it("drops blocked metadata keys", () => {
    const sanitized = sanitizeEventProperties({
      metadata: {
        email: "reader@example.com",
        action_id: "website",
        lat: 33.4,
      },
    });
    assert.deepEqual(sanitized.metadata, { action_id: "website" });
  });
});

describe("shouldEmitOnce", () => {
  it("allows first emit only", () => {
    resetAnalyticsDedupe();
    assert.equal(shouldEmitOnce("article_opened:1"), true);
    assert.equal(shouldEmitOnce("article_opened:1"), false);
  });
});
