import { test } from "node:test";
import assert from "node:assert/strict";
import { isRedeemableUrl, normalizeRedeemUrl } from "./redeemUrl.ts";

test("returns the exact AWIN url unmodified", () => {
  const url = "https://tidd.ly/4w3vAiu";
  assert.equal(normalizeRedeemUrl(url), url);
  assert.equal(isRedeemableUrl(url), true);
});

test("preserves tracking query parameters byte-for-byte", () => {
  const url =
    "https://www.awin1.com/cread.php?awinmid=1234&awinaffid=567&clickref=abc&ued=https%3A%2F%2Fexample.com";
  assert.equal(normalizeRedeemUrl(url), url);
});

test("trims surrounding whitespace but does not alter the url itself", () => {
  assert.equal(
    normalizeRedeemUrl("  https://tidd.ly/4w3vAiu  "),
    "https://tidd.ly/4w3vAiu"
  );
});

test("missing or blank urls are not redeemable", () => {
  assert.equal(normalizeRedeemUrl(null), null);
  assert.equal(normalizeRedeemUrl(undefined), null);
  assert.equal(normalizeRedeemUrl(""), null);
  assert.equal(normalizeRedeemUrl("   "), null);
  assert.equal(isRedeemableUrl(null), false);
});

test("rejects non-http(s) and malformed schemes", () => {
  assert.equal(normalizeRedeemUrl("javascript:alert(1)"), null);
  assert.equal(normalizeRedeemUrl("mailto:hi@example.com"), null);
  assert.equal(normalizeRedeemUrl("ftp://example.com/file"), null);
  assert.equal(normalizeRedeemUrl("not a url"), null);
  assert.equal(isRedeemableUrl("javascript:alert(1)"), false);
});
