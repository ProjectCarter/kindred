import test from "node:test";
import assert from "node:assert/strict";
import {
  GENERATION_FIRST_PAINT_MAX_MS,
  GENERATION_POLL_MAX_MS,
  parseGenerateEditionResponse,
} from "./generationJobs.ts";

test("parseGenerateEditionResponse — sync ready", () => {
  const parsed = parseGenerateEditionResponse({
    success: true,
    alreadyReady: true,
    editionId: "abc-123",
    metroKey: "seattle-wa",
    editionDate: "2026-07-17",
  });
  assert.equal(parsed?.kind, "ready");
  if (parsed?.kind === "ready") {
    assert.equal(parsed.editionId, "abc-123");
    assert.equal(parsed.metroKey, "seattle-wa");
    assert.equal(parsed.alreadyReady, true);
  }
});

test("parseGenerateEditionResponse — async enqueue", () => {
  const parsed = parseGenerateEditionResponse({
    accepted: true,
    async: true,
    status: "pending",
    metroKey: "phoenix-az",
    editionDate: "2026-07-17",
    pollIntervalMs: 5000,
  });
  assert.equal(parsed?.kind, "async");
  if (parsed?.kind === "async") {
    assert.equal(parsed.status, "pending");
    assert.equal(parsed.pollIntervalMs, 5000);
  }
});

test("parseGenerateEditionResponse — error body", () => {
  const parsed = parseGenerateEditionResponse({
    error: "Unsupported market",
    code: "UNSUPPORTED_MARKET",
  });
  assert.equal(parsed?.kind, "error");
  if (parsed?.kind === "error") {
    assert.equal(parsed.code, "UNSUPPORTED_MARKET");
  }
});

test("parseGenerateEditionResponse — invalid body", () => {
  assert.equal(parseGenerateEditionResponse(null), null);
  assert.equal(parseGenerateEditionResponse({ accepted: true }), null);
});

test("GENERATION_POLL_MAX_MS allows long Seattle builds", () => {
  assert.ok(GENERATION_POLL_MAX_MS >= 5 * 60_000);
});

test("GENERATION_FIRST_PAINT_MAX_MS is 60 seconds", () => {
  assert.equal(GENERATION_FIRST_PAINT_MAX_MS, 60_000);
});
