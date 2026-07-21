import test from "node:test";
import assert from "node:assert/strict";
import {
  eventDisplayImageKind,
  eventHasDisplayImage,
  resolveEventDisplayImage,
} from "./eventDisplayImage.ts";

test("uses authorized listing photography when rights grant display", () => {
  const resolved = resolveEventDisplayImage({
    category: "music",
    imageUrl: "https://cdn.example.com/event.jpg",
    imageRights: {
      authorized: true,
      policy: "api_granted",
      sourceId: "ticketmaster",
    },
  });
  assert.equal(resolved.kind, "listing");
  assert.deepEqual(resolved.source, { uri: "https://cdn.example.com/event.jpg" });
});

test("never displays unlicensed provider thumbnails", () => {
  const resolved = resolveEventDisplayImage({
    category: "comedy",
    imageUrl: "https://cdn.example.com/eventbrite.jpg",
    imageRights: {
      authorized: false,
      policy: "prohibited",
      sourceId: "eventbrite",
    },
  });
  assert.equal(resolved.kind, "category");
  assert.notDeepEqual(resolved.source, { uri: "https://cdn.example.com/eventbrite.jpg" });
});

test("falls back to verified category art for every event category", () => {
  const categories = [
    "music",
    "comedy",
    "arts",
    "family",
    "sports",
    "food",
    "market",
    "nightlife",
    "community",
  ] as const;

  for (const category of categories) {
    assert.equal(
      eventDisplayImageKind({ category, imageUrl: null, imageRights: undefined }),
      "category"
    );
    assert.equal(
      eventHasDisplayImage({ category, imageUrl: null, imageRights: undefined }),
      true
    );
  }
});
